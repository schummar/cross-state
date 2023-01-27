import type { Cancel } from 'schummar-state/*';
import type { PersistStorage, PersistStorageWithKeys } from './persistStorage';
import { normalizeStorage } from './persistStorage';
import type { Store } from '@';
import { store as createStore } from '@';
import { diff } from '@lib/diff';
import type { WildcardPath, WildcardPathAsArray } from '@lib/path';
import { castArrayPath, get, set } from '@lib/propAccess';
import { queue } from '@lib/queue';

export interface PersistOptions<T> {
  id: string;
  storage: PersistStorage;
  paths?:
    | WildcardPath<T>[]
    | {
        path: WildcardPath<T>;
        throttleMs?: number;
      }[];
  throttleMs?: number;
}

class Persist<T> {
  storage: PersistStorageWithKeys;

  paths: {
    path: WildcardPathAsArray<T>;
    throttleMs?: number;
  }[];

  channel: BroadcastChannel;

  queue = queue();

  handles = new Set<Cancel>();

  stopped = false;

  updateInProgress?: [any, any];

  constructor(public readonly store: Store<T>, public readonly options: PersistOptions<T>) {
    this.storage = normalizeStorage(options.storage);

    this.paths = (options.paths ?? [])
      .map<{
        path: WildcardPathAsArray<T>;
        throttleMs?: number;
      }>((p) =>
        typeof p === 'string' || Array.isArray(p)
          ? {
              path: castArrayPath(p as any) as WildcardPathAsArray<T>,
            }
          : {
              path: castArrayPath(p.path as any) as WildcardPathAsArray<T>,
              throttleMs: p.throttleMs,
            },
      )
      .sort((a, b) => b.path.length - a.path.length);

    this.channel = new BroadcastChannel(`cross-state-persist_${options.id}`);

    this.watchStore();

    this.watchStorage();
  }

  watchStore() {
    let committed = this.store.get();

    const cancel = this.store.sub(
      (value, before) => {
        if (this.updateInProgress) {
          const [path, updatedValue] = this.updateInProgress;

          if (get(value, path) === updatedValue) {
            console.log('equal', path, updatedValue, value, before);
            return;
          }
        }

        const [patches] = diff(committed, value);
        committed = value;

        for (const patch of patches) {
          if (patch.op !== 'replace') {
            return;
          }

          console.debug('watchStore', JSON.stringify(patch.path), patch.value);
          this.queue(() => this.save(JSON.stringify(patch.path), patch.value));
        }
      },
      { runNow: false },
    );

    this.handles.add(cancel);
  }

  async watchStorage() {
    const keys = await this.storage.keys();

    if (this.stopped) {
      return;
    }

    for (const key of keys) {
      this.queue(() => this.load(key));
    }

    const listener = (event: MessageEvent) => {
      console.log('message', event.data);
      this.queue(() => this.load(event.data));
    };

    this.channel.addEventListener('message', listener);
    this.handles.add(() => this.channel.removeEventListener('message', listener));
  }

  async load(key: string) {
    let value = this.storage.getItem(key);

    if (value instanceof Promise) {
      value = await value;
    }

    if (this.stopped) {
      return;
    }

    if (value) {
      const path = JSON.parse(key);
      const parsedValue = value === 'undefined' ? undefined : JSON.parse(value);

      this.updateInProgress = [path, parsedValue];
      console.log('apply', path, parsedValue);

      this.store.update((state) => set(state, path, parsedValue));
      this.updateInProgress = undefined;
    }
  }

  async save(key: string, value: unknown) {
    const serializedValue = value === undefined ? 'undefined' : JSON.stringify(value);
    const result = this.storage.setItem(key, serializedValue);

    if (result instanceof Promise) {
      await result;
    }

    this.channel.postMessage(key);
  }

  async stop() {
    console.debug('stop');

    this.stopped = true;
    await this.queue.whenDone();

    this.channel.close();
    // this.queue.clear();
  }
}

export function persist<T>(store: Store<T>, options: PersistOptions<T>): Persist<T> {
  return new Persist<T>(store, options);
}

const items = new Map<string, string>();

const storage: PersistStorage = {
  getItem(key) {
    return items.get(key) ?? null;
  },
  setItem(key, value) {
    items.set(key, value);
  },
  removeItem(key) {
    items.delete(key);
  },
  keys() {
    return [...items.keys()];
  },
};

const s1 = createStore({
  a: 1,
  // b: { c: 2, d: 3 },
  // e: new Map([
  //   [1, 1],
  //   [2, 2],
  // ]),
});

const _p1 = persist(s1, {
  id: 'test',
  storage,
  // paths: ['e', 'b.c', 'e.*'],
  paths: ['a'],
});

const s2 = createStore(s1.get());

const _p2 = persist(s2, {
  id: 'test',
  storage,
  // paths: ['e', 'b.c', 'e.*'],
  paths: ['a'],
});

// s1.set('a', 2);
// s1.set('b', { c: 3, d: 4 });
// s1.set(['b', 'c'], 4);
// s1.set(
//   'e',
//   new Map([
//     [1, 2],
//     [2, 3],
//   ]),
// );
s1.set(['a'], 2);
s2.set(['a'], 3);

// await new Promise((r) => setTimeout(r, 1000));

await new Promise((r) => setTimeout(r, 1000));
await _p1.stop();
await _p2.stop();
console.log('s1', s1.get());
console.log('s2', s2.get());
