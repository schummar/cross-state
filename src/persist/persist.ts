import { isAncestor } from './persistPathHelpers';
import type { PersistStorage, PersistStorageWithKeys } from './persistStorage';
import { normalizeStorage } from './persistStorage';
import type { Cancel, Store } from '@';
import { diff } from '@lib/diff';
import { simpleShallowEquals } from '@lib/equals';
import { maybeAsync, maybeAsyncArray } from '@lib/maybeAsync';
import type { KeyType, WildcardPath } from '@lib/path';
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

export class Persist<T> {
  storage: PersistStorageWithKeys;

  paths: {
    path: KeyType[];
    throttleMs?: number;
  }[];

  channel: BroadcastChannel;

  queue = queue();

  handles = new Set<Cancel>();

  stopped = false;

  updateInProgress?: [any, any];

  constructor(public readonly store: Store<T>, public readonly options: PersistOptions<T>) {
    this.storage = normalizeStorage(options.storage);
    this.channel = new BroadcastChannel(`cross-state-persist_${options.id}`);

    this.paths = (options.paths ?? [])
      .map<{
        path: KeyType[];
        throttleMs?: number;
      }>((p) =>
        typeof p === 'string' || Array.isArray(p)
          ? {
              path: castArrayPath(p as any),
            }
          : {
              path: castArrayPath(p.path as any),
              throttleMs: p.throttleMs,
            },
      )
      .sort((a, b) => b.path.length - a.path.length);

    if (this.paths.length === 0) {
      this.paths.push({ path: ['*'] });
    }

    this.watchStore();
    this.watchStorage();
  }

  watchStore() {
    let committed = this.store.get();

    const cancel = this.store.sub(
      (value) => {
        const [patches] = diff(committed, value);
        committed = value;

        for (const patch of patches) {
          if (
            this.updateInProgress &&
            simpleShallowEquals(this.updateInProgress[0], patch.path) &&
            this.updateInProgress[1] === (patch.op === 'remove' ? undefined : patch.value)
          ) {
            continue;
          }

          const ancestor = this.paths.find((p) => isAncestor(p.path, patch.path));

          if (!ancestor) {
            continue;
          }

          const pathToSave = patch.path.slice(0, ancestor.path.length);
          this.queue(() => this.save(pathToSave), pathToSave);
        }
      },
      { runNow: false },
    );

    this.handles.add(cancel);
  }

  async watchStorage() {
    let keys = this.storage.keys();
    if (keys instanceof Promise) {
      keys = await keys;
    }

    if (this.stopped) {
      return;
    }

    for (const key of keys) {
      const path = JSON.parse(key);
      this.queue(() => this.load(path));
    }

    const listener = (event: MessageEvent) => {
      this.queue(() => this.load(event.data));
    };

    this.channel.addEventListener('message', listener);
    this.handles.add(() => this.channel.removeEventListener('message', listener));
  }

  load(path: KeyType[]) {
    const matchingPath = this.paths.find(
      (p) => p.path.length === path.length && isAncestor(p.path, path),
    );
    if (!matchingPath) {
      return;
    }

    const key = JSON.stringify(path);

    return maybeAsync(this.storage.getItem(key), (value) => {
      if (this.stopped || !value) {
        return;
      }

      const inSaveQueue = this.queue
        .getRefs()
        .find((ref) => isAncestor(ref, path) || isAncestor(path, ref));
      if (inSaveQueue) {
        return;
      }

      const parsedValue = value === 'undefined' ? undefined : JSON.parse(value);

      this.updateInProgress = [path, parsedValue];
      this.store.update((state) => set(state, path as any, parsedValue));
      this.updateInProgress = undefined;
    });
  }

  save(path: KeyType[]) {
    const key = JSON.stringify(path);
    const value = get(this.store.get(), path as any);
    const serializedValue = value === undefined ? 'undefined' : JSON.stringify(value);

    return maybeAsync(this.storage.setItem(key, serializedValue), () => {
      this.channel.postMessage(path);

      return maybeAsync(this.storage.keys(), (keys) => {
        const toRemove = keys.filter((k) => {
          const parsedKey = JSON.parse(k);
          return (
            parsedKey.length > path.length && isAncestor(path, parsedKey)
            // !this.queue.getRefs().find((ref) => isAncestor(ref, parsedKey))
          );
        });

        return maybeAsyncArray(toRemove.map((k) => () => this.storage.removeItem(k)));
      });
    });
  }

  async stop() {
    this.stopped = true;

    for (const handle of this.handles) {
      handle();
    }

    await this.queue.whenDone();
    this.channel.close();
  }
}

export function persist<T>(store: Store<T>, options: PersistOptions<T>): Persist<T> {
  return new Persist<T>(store, options);
}
