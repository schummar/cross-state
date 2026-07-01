import type { Collection } from '@collection/collection';
import type { CollectionDownMessage, ServerConnection } from '@collection/connection';
import type { GetParam, GetParamIntersection } from '@collection/types';
import type { DisposableCancel } from '@core';
import disposable from '@lib/disposable';
import type { MaybePromise } from '@lib/maybePromise';
import { queue, type Queue } from '@lib/queue';

export interface ServerCollectionOptions<TCollection extends Collection> {
  collection: TCollection;
}

interface ConnectionState<TCollection extends Collection> {
  queries: Map<string, QueryState<TCollection>>;
  sendQueue: Queue;
}

interface QueryState<TCollection extends Collection> {
  query: GetParam<TCollection, 'query'>;
  ac: AbortController;
}

export abstract class ServerCollection<TCollection extends Collection> {
  protected connections: Map<
    ServerConnection<GetParam<TCollection, 'user'>>,
    ConnectionState<TCollection>
  > = new Map();
  protected updateQueue: Queue = queue();

  constructor(public readonly options: ServerCollectionOptions<TCollection>) {}

  connect(connection: ServerConnection<GetParam<TCollection, 'user'>>): DisposableCancel {
    if (this.connections.has(connection)) {
      throw new Error('Connection already exists');
    }

    const state: ConnectionState<TCollection> = {
      queries: new Map(),
      sendQueue: queue(),
    };
    this.connections.set(connection, state);

    const cancel = connection.onMessage(this.options.collection.domain, (message) => {
      switch (message[0]) {
        case 'enable':
          {
            const [, queryKey, query, t] = message;
            if (state.queries.has(queryKey)) {
              throw new Error(`Set key ${queryKey} already exists`);
            }

            state.queries.set(queryKey, {
              query,
              ac: new AbortController(),
            });
            void state.sendQueue(() => this.fetch(connection, queryKey, t));
          }
          break;

        case 'disable':
          {
            const [, queryKey] = message;
            const queryState = state.queries.get(queryKey);
            queryState?.ac.abort();
            state.queries.delete(queryKey);
          }
          break;

        case 'update': {
          const [, item] = message;

          this.updateQueue(async () => {
            const updatedItem = await this.update(item);

            for (const [otherConnection, otherState] of this.connections) {
              if (
                otherState.queries
                  .values()
                  .some((query) => this.options.collection.matches(updatedItem, query))
              ) {
                otherConnection.send(this.options.collection.domain, [['update', updatedItem]]);
              }
            }
          });
        }

        case 'delete': {
          const [, id] = message;

          this.updateQueue(async () => {
            const t = await this.delete(id);

            for (const [otherConnection, otherState] of this.connections) {
              if (
                otherState.queries
                  .values()
                  .some((query) =>
                    this.options.collection.matches(
                      { [this.options.collection.id]: id } as any,
                      query,
                    ),
                  )
              ) {
                otherConnection.send(this.options.collection.domain, [['delete', id, t]]);
              }
            }
          });
        }
      }
    });

    return disposable(() => {
      for (const queryState of state.queries.values()) {
        queryState.ac.abort();
      }
      this.connections.delete(connection);
      cancel();
    });
  }

  protected async fetch(
    connection: ServerConnection<GetParam<TCollection, 'user'>>,
    queryKey: string,
    t: number | null,
  ): Promise<void> {
    const connectionState = this.connections.get(connection);
    const queryState = connectionState?.queries.get(queryKey);

    if (!connectionState || !queryState) {
      throw new Error('Query not found');
    }

    const otherQueries = Array.from(connectionState.queries.values())
      .filter((q) => q.query !== queryState.query)
      .map((q) => q.query);

    const items = await this.list([queryState.query], otherQueries, t);
    if (queryState.ac.signal.aborted) {
      return;
    }

    let buffer: CollectionDownMessage[] = [];

    const sendChunk = (minSize = 100) => {
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

      buffer.push(['update', item]);
      sendChunk();
    }

    buffer.push(['init', queryKey]);
    sendChunk(0);
  }

  abstract list(
    include: GetParam<TCollection, 'query'>[],
    exclude: GetParam<TCollection, 'query'>[],
    t: number | null,
  ): MaybePromise<
    Iterable<GetParam<TCollection, 'item'>> | AsyncIterable<GetParam<TCollection, 'item'>>
  >;

  abstract update(item: GetParam<TCollection, 'item'>): MaybePromise<GetParam<TCollection, 'item'>>;

  abstract delete(id: GetParam<TCollection, 'id'>): MaybePromise<number>;
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
