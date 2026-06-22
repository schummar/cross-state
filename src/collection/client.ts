import type { AnyCollection } from '@collection/collection';
import { type ClientConnection, type CollectionDownMessage } from '@collection/connection';
import type { GetItem, GetQuery } from '@collection/types';
import { Computed } from '@core/store';
import { deepEqual } from '@lib/equals';
import { simpleHash } from '@lib/hash';
import type { StandardSchemaV1 } from '@standard-schema/spec';

export interface CollectionClientOptions<TCollection extends AnyCollection> {
  collection: TCollection;
  connection: ClientConnection;
}

class CollSet<TCollection extends AnyCollection> extends Computed<GetItem<TCollection>[]> {
  isInitialized = false;
  t: number | null = null;

  constructor(
    public readonly client: CollectionClient<TCollection>,
    public readonly query: GetQuery<TCollection>,
  ) {
    super({
      compute: () => {
        if (!this.isInitialized) {
          return [];
        }

        return Array.from(client.items.values()).filter((item) => {
          return client.options.collection.options.matches(item, this.query);
        });
      },
      dependencies: [],
    });
  }
}

export class CollectionClient<TCollection extends AnyCollection> implements Disposable {
  items: Map<string, GetItem<TCollection>> = new Map();
  dirty: Set<string> = new Set();
  sets: Map<string, CollSet<TCollection>> = new Map();
  disposables: DisposableStack = new DisposableStack();

  constructor(public readonly options: CollectionClientOptions<TCollection>) {
    this.start();
  }

  protected start(): void {
    const { collection, connection } = this.options;

    this.disposables.use(
      connection.onMessage(collection.options.domain, (message) => {
        this.receive(message);
      }),
    );

    this.disposables.use(
      connection.onReconnect(collection.options.domain, () => {
        this.reconnect();
      }),
    );
  }

  [Symbol.dispose](): void {
    this.disposables.dispose();
  }

  protected async receive(args: CollectionDownMessage): Promise<void> {
    const { collection } = this.options;

    switch (args[0]) {
      case 'update': {
        const result = (await collection.options.schema['~standard'].validate(
          args[1],
        )) as StandardSchemaV1.Result<GetItem<TCollection>>;

        if (result.issues) {
          console.error('Invalid item received from server:', result.issues);
          return;
        }

        const newItem = result.value;
        const t = args[2];
        const id = newItem[collection.options.id];
        const key = simpleHash(id);
        const oldItem = this.items.get(key);
        const isDirty = this.dirty.has(key);

        if (isDirty) {
          if (!oldItem || !deepEqual(oldItem, newItem)) {
            return;
          }

          this.dirty.delete(key);
        }

        this.items.set(key, newItem);

        if (oldItem) {
          this.notifyItem(oldItem, t);
        }
        this.notifyItem(newItem, t);

        break;
      }

      case 'delete': {
        const id = args[1];
        const t = args[2];
        const key = simpleHash(id);
        const oldItem = this.items.get(key);
        const isDirty = this.dirty.has(key);

        if (isDirty) {
          if (oldItem) {
            return;
          }

          this.dirty.delete(key);
        }

        this.items.delete(key);

        if (oldItem) {
          this.notifyItem(oldItem, t);
        }

        break;
      }

      case 'init': {
        const setKey = args[1];
        const set = this.sets.get(setKey);

        if (set?.isActive()) {
          set.isInitialized = true;
          set.invalidate();
        }
      }
    }
  }

  protected reconnect(): void {
    for (const [setKey, set] of this.sets) {
      if (!set.isActive()) {
        continue;
      }

      this.options.connection.send(this.options.collection.options.domain, [
        ['enable', setKey, set.query, set.t],
      ]);
    }
  }

  getSet(query: GetQuery<TCollection>): CollSet<TCollection> {
    const setKey = simpleHash(query);
    const set = this.sets.get(setKey);

    if (set) {
      return set;
    }

    const newSet = new CollSet(this, query);

    newSet.addEffect(() => {
      this.options.connection.send(this.options.collection.options.domain, [
        ['enable', setKey, query, set!.t],
      ]);

      return () => {
        this.options.connection.send(this.options.collection.options.domain, [
          ['disable', setKey, query],
        ]);
      };
    });

    this.sets.set(setKey, newSet);
    return newSet;
  }

  protected notifyItem(item: GetItem<TCollection>, t: number): void {
    for (const set of Array.from(this.sets.values())) {
      if (!set.isActive()) {
        continue;
      }

      if (this.options.collection.options.matches(item, set.query)) {
        set.t = t;
        set.invalidate();
      }
    }
  }

  protected notifySet(setKey: string, t: number): void {
    const set = this.sets.get(setKey);

    if (set) {
      set.t = t;
      set.invalidate();
    }
  }
}

export function createCollectionClient<TCollection extends AnyCollection>(
  options: CollectionClientOptions<TCollection>,
): CollectionClient<TCollection> {
  return new CollectionClient<TCollection>(options);
}
