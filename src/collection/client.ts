import type { Collection } from '@collection/collection';
import { type ClientConnection, type CollectionDownMessage } from '@collection/connection';
import { getTime } from '@collection/helpers';
import type { GetParam } from '@collection/types';
import { Computed } from '@core/store';
import { deepEqual } from '@lib/equals';
import { simpleHash } from '@lib/hash';
import { queue, type Queue } from '@lib/queue';
import type { StandardSchemaV1 } from '@standard-schema/spec';

export interface ClientCollectionOptions<TCollection extends Collection> {
  collection: TCollection;
  connection: ClientConnection;
}

class CollSet<TCollection extends Collection> extends Computed<{
  items: GetParam<TCollection, 'item'>[];
  isInitialized: boolean;
}> {
  isInitialized = false;
  t: number | null = null;

  constructor(
    public readonly client: ClientCollection<TCollection>,
    public readonly query: GetParam<TCollection, 'query'>,
  ) {
    super({
      compute: () => {
        const items = Array.from(client.items.values()).filter((item) => {
          return client.options.collection.matches(item, this.query);
        });

        return {
          items,
          isInitialized: this.isInitialized,
        };
      },
      dependencies: [],
    });
  }
}

export class ClientCollection<TCollection extends Collection> implements Disposable {
  items: Map<string, GetParam<TCollection, 'item'>> = new Map();
  dirty: Set<string> = new Set();
  sets: Map<string, CollSet<TCollection>> = new Map();
  disposables: DisposableStack = new DisposableStack();
  protected q: Queue = queue();

  constructor(public readonly options: ClientCollectionOptions<TCollection>) {
    this.start();
  }

  protected start(): void {
    const { collection, connection } = this.options;

    this.disposables.use(
      connection.onMessage(collection.domain, (message) => {
        this.receive(message);
      }),
    );

    this.disposables.use(
      connection.onReconnect(collection.domain, () => {
        this.reconnect();
      }),
    );
  }

  [Symbol.dispose](): void {
    this.disposables.dispose();
  }

  protected receive(args: CollectionDownMessage): void {
    void this.q(async () => {
      const { collection } = this.options;

      switch (args[0]) {
        case 'update': {
          const result = (await collection.schema['~standard'].validate(
            args[1],
          )) as StandardSchemaV1.Result<GetParam<TCollection, 'item'>>;

          if (result.issues) {
            console.error('Invalid item received from server:', result.issues);
            return;
          }

          this.internalUpdate(result.value, true);
          break;
        }

        case 'delete': {
          const [, id, t] = args;
          this.internalDelete(id as GetParam<TCollection, 'id'>, t);
          break;
        }

        case 'init': {
          const [, setKey] = args;
          const set = this.sets.get(setKey);

          if (set?.isActive()) {
            set.isInitialized = true;
            set.invalidate();
          }
        }
      }
    });
  }

  protected internalUpdate(item: GetParam<TCollection, 'item'>, fromUpstream: boolean): void {
    const id = item[this.options.collection.id];
    const key = simpleHash(id);
    const oldItem = this.items.get(key);

    if (fromUpstream && this.dirty.has(key)) {
      if (!oldItem || !deepEqual(oldItem, item)) {
        return;
      }

      this.dirty.delete(key);
    }

    this.items.set(key, item);

    if (!fromUpstream) {
      this.dirty.add(key);
    }

    if (oldItem) {
      this.notifyItem(oldItem, null);
    }

    const serverTime = fromUpstream ? getTime(this.options.collection, item) : null;
    this.notifyItem(item, serverTime);
  }

  protected internalDelete(id: GetParam<TCollection, 'id'>, serverTime: number | null): void {
    const key = simpleHash(id);
    const oldItem = this.items.get(key);

    if (serverTime !== null && this.dirty.has(key)) {
      if (oldItem) {
        return;
      }

      this.dirty.delete(key);
    }

    this.items.delete(key);

    if (serverTime === null) {
      this.dirty.add(key);
    }

    if (oldItem) {
      this.notifyItem(oldItem, serverTime);
    }
  }

  protected reconnect(): void {
    for (const [setKey, set] of this.sets) {
      if (!set.isActive()) {
        continue;
      }

      this.options.connection.send(this.options.collection.domain, [
        ['enable', setKey, set.query, set.t],
      ]);
    }
  }

  protected notifyItem(item: GetParam<TCollection, 'item'>, serverTime: number | null): void {
    for (const set of Array.from(this.sets.values())) {
      if (!set.isActive()) {
        continue;
      }

      if (this.options.collection.matches(item, set.query)) {
        if (serverTime !== null) {
          set.t = serverTime;
        }
        set.invalidate();
      }
    }
  }

  async get(query: GetParam<TCollection, 'query'>): Promise<GetParam<TCollection, 'item'>[]> {
    const set = this.getSet(query);
    const result = await set.once((x) => x.isInitialized);
    return result.items;
  }

  update(item: GetParam<TCollection, 'item'>): void {
    this.internalUpdate(item, false);
    this.options.connection.send(this.options.collection.domain, [['update', item]]);
  }

  delete(id: GetParam<TCollection, 'id'>): void {
    this.internalDelete(id, null);
    this.options.connection.send(this.options.collection.domain, [['delete', id, 0]]);
  }

  getSet(query: GetParam<TCollection, 'query'>): CollSet<TCollection> {
    const setKey = simpleHash(query);
    const set = this.sets.get(setKey);

    if (set) {
      return set;
    }

    const newSet = new CollSet(this, query);

    newSet.addEffect(() => {
      this.options.connection.send(this.options.collection.domain, [
        ['enable', setKey, query, newSet.t],
      ]);

      return () => {
        this.options.connection.send(this.options.collection.domain, [['disable', setKey]]);
        newSet.isInitialized = false;
        newSet.invalidate();
      };
    });

    this.sets.set(setKey, newSet);
    return newSet;
  }
}

export function createClientCollection<TCollection extends Collection>(
  options: ClientCollectionOptions<TCollection>,
): ClientCollection<TCollection> {
  return new ClientCollection<TCollection>(options);
}
