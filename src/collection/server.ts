import type { Collection } from '@collection/collection';
import type {
  CollectionDownMessage,
  CollectionUpMessage,
  ServerConnection,
} from '@collection/connection';
import { getTime } from '@collection/helpers';
import MatchCache from '@collection/matchCache';
import type { GetParam, GetParamIntersection } from '@collection/types';
import type { DisposableCancel } from '@core';
import disposable from '@lib/disposable';
import { simpleHash } from '@lib/hash';
import type { MaybePromise } from '@lib/maybePromise';
import { queue, type Queue } from '@lib/queue';

export interface ServerCollectionOptions<TCollection extends Collection> {
  collection: TCollection;
  chunkSize?: number;
  deleteCacheSize?: number;
}

interface ConnectionState<TCollection extends Collection> {
  queries: Map<string, QueryState<TCollection>>;
}

interface QueryState<TCollection extends Collection> {
  query: GetParam<TCollection, 'query'>;
  ac: AbortController;
  initialFetchInProgress: boolean;
}

export interface ServerUpdateResult<TCollection extends Collection> {
  oldItem: GetParam<TCollection, 'item'> | null;
  newItem: GetParam<TCollection, 'item'>;
}

export interface ServerDeleteResult<TCollection extends Collection> {
  item: GetParam<TCollection, 'item'>;
  t: number;
}

export abstract class ServerCollection<TCollection extends Collection> {
  protected connections: Map<
    ServerConnection<GetParam<TCollection, 'user'>>,
    ConnectionState<TCollection>
  > = new Map();

  protected deleteCache: ServerDeleteResult<TCollection>[] = [];
  protected knownDeletionsThreshold: number = 0;
  protected updateQueue: Queue = queue();

  constructor(public readonly options: ServerCollectionOptions<TCollection>) {}

  connect(connection: ServerConnection<GetParam<TCollection, 'user'>>): DisposableCancel {
    if (this.connections.has(connection)) {
      throw new Error('Connection already exists');
    }

    const state: ConnectionState<TCollection> = {
      queries: new Map(),
    };
    this.connections.set(connection, state);

    const cancel = connection.onMessage(this.options.collection.domain, (message) => {
      this.receive(connection, state, message);
    });

    return disposable(() => {
      for (const queryState of state.queries.values()) {
        queryState.ac.abort();
      }
      this.connections.delete(connection);

      cancel();
    });
  }

  protected receive(
    connection: ServerConnection<GetParam<TCollection, 'user'>>,
    state: ConnectionState<TCollection>,
    message: CollectionUpMessage,
  ): void {
    switch (message[0]) {
      case 'enable':
        {
          const [, query, t] = message;
          const queryKey = simpleHash(query);
          if (state.queries.has(queryKey)) {
            throw new Error(`Set key ${queryKey} already exists`);
          }

          state.queries.set(queryKey, {
            query,
            ac: new AbortController(),
            initialFetchInProgress: true,
          });

          void this.initialFetchQuery(connection, queryKey, t).catch((error) => {
            if (!state.queries.get(queryKey)?.ac.signal.aborted) {
              console.error('Error during initial fetch query:', error);
            }
          });
        }
        break;

      case 'disable':
        {
          const [, query] = message;
          const queryKey = simpleHash(query);

          const queryState = state.queries.get(queryKey);
          queryState?.ac.abort();
          state.queries.delete(queryKey);
        }
        break;

      case 'update': {
        const [, item] = message;

        this.updateQueue(async () => {
          const { oldItem, newItem } = await this.update(item);
          this.sendToMatchingConnections(
            oldItem,
            newItem,
            getTime(this.options.collection, newItem),
          );
        });
      }

      case 'delete': {
        const [, id] = message;

        this.updateQueue(async () => {
          const entry = await this.delete(id);

          if (!entry) {
            return;
          }

          this.deleteCache.push(entry);

          const deleteCacheSize = this.options.deleteCacheSize ?? 100_000;
          if (this.deleteCache.length > deleteCacheSize * 2) {
            this.deleteCache = this.deleteCache.slice(-deleteCacheSize);
          }

          this.sendToMatchingConnections(entry.item, null, entry.t);
        });
      }
    }
  }

  protected async initialFetchQuery(
    connection: ServerConnection<GetParam<TCollection, 'user'>>,
    queryKey: string,
    t: number | null,
  ): Promise<void> {
    const connectionState = this.connections.get(connection);
    const queryState = connectionState?.queries.get(queryKey);

    if (!connectionState || !queryState) {
      throw new Error('Query not found');
    }

    const deletes = this.deleteCache
      .filter((entry) => t === null || entry.t >= t)
      .filter((entry) => this.options.collection.matches(entry.item, queryState.query));

    const syncedQueries = Array.from(connectionState.queries.values())
      .filter((q) => !q.initialFetchInProgress)
      .map((q) => q.query);

    const items = await this.list([queryState.query], syncedQueries, t);
    if (queryState.ac.signal.aborted) {
      return;
    }

    let buffer: CollectionDownMessage[] = [];

    const sendChunk = (minSize = this.options.chunkSize ?? 1000) => {
      if (buffer.length < minSize) {
        return;
      }

      connection.send(this.options.collection.domain, buffer);
      buffer = [];
    };

    for await (const item of items) {
      if (queryState.ac.signal.aborted) {
        return;
      }

      const deleteIndex = deletes.findLastIndex(
        (entry) => entry.t <= getTime(this.options.collection, item),
      );
      if (deleteIndex !== -1) {
        const pushNow = deletes.splice(0, deleteIndex + 1);
        for (const entry of pushNow) {
          buffer.push(['delete', entry.item[this.options.collection.id], entry.t]);
        }
      }

      buffer.push(['update', item]);
      sendChunk();
    }

    for (const entry of deletes) {
      buffer.push(['delete', entry.item[this.options.collection.id], entry.t]);
    }

    buffer.push(['init', queryState.query]);
    sendChunk(0);

    queryState.initialFetchInProgress = false;
  }

  protected sendToMatchingConnections(
    oldItem: GetParam<TCollection, 'item'> | null,
    newItem: GetParam<TCollection, 'item'> | null,
    t: number,
  ): void {
    const oldItemMatchCache = new MatchCache(this.options.collection);
    const newItemMatchCache = new MatchCache(this.options.collection);

    for (const [connection, state] of this.connections) {
      if (
        newItem !== null &&
        state.queries.entries().some(([queryKey, queryState]) => {
          return newItemMatchCache.matches(newItem, queryKey, queryState.query);
        })
      ) {
        connection.send(this.options.collection.domain, [['update', newItem]]);
      } else if (
        oldItem !== null &&
        state.queries.entries().some(([queryKey, queryState]) => {
          return oldItemMatchCache.matches(oldItem, queryKey, queryState.query);
        })
      ) {
        const id = oldItem[this.options.collection.id as keyof typeof oldItem];
        connection.send(this.options.collection.domain, [['delete', id, t]]);
      }
    }
  }

  abstract list(
    include: GetParam<TCollection, 'query'>[],
    exclude: GetParam<TCollection, 'query'>[],
    t: number | null,
  ): MaybePromise<
    Iterable<GetParam<TCollection, 'item'>> | AsyncIterable<GetParam<TCollection, 'item'>>
  >;

  abstract update(
    item: GetParam<TCollection, 'item'>,
  ): MaybePromise<ServerUpdateResult<TCollection>>;

  abstract delete(
    id: GetParam<TCollection, 'id'>,
  ): MaybePromise<ServerDeleteResult<TCollection> | null>;
}

export interface ServerCollectionHubOptions<TCollections extends Collection[]> {
  collections: { [K in keyof TCollections]: ServerCollection<TCollections[K]> };
}

export class ServerCollectionHub<const TCollections extends Collection[]> {
  constructor(public readonly options: ServerCollectionHubOptions<TCollections>) {}

  connect(
    connection: ServerConnection<GetParamIntersection<TCollections, 'user'>>,
  ): DisposableCancel {
    const disposables = new DisposableStack();

    for (const collection of this.options.collections) {
      disposables.use(collection.connect(connection));
    }

    return disposable(() => {
      disposables.dispose();
    });
  }
}
