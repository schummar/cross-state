import { type Cancel, type Duration, type Store } from '@core';
import { calcDuration } from '@lib/calcDuration';
import { shallowEqual } from '@lib/equals';
import { fromExtendedJsonString, toExtendedJsonString } from '@lib/extendedJson';
import isPromise from '@lib/isPromise';
import type { KeyType, WildcardPath } from '@lib/path';
import promiseChain from '@lib/promiseChain';
import { castArrayPath, get, remove, set } from '@lib/propAccess';
import { queue } from '@lib/queue';
import { subscribePatches } from '@patches/patchMethods';
import { isAncestor, split } from '@persist/persistPathHelpers';
import {
  normalizeStorage,
  type PersistStorage,
  type PersistStorageWithListItems,
} from './persistStorage';

type PathOption<T> =
  | WildcardPath<T>
  | {
      path: WildcardPath<T>;
      // throttle?: Duration;
    };

type Key = { type: 'internal'; path: string } | { type: 'data'; path: KeyType[] };

export interface PersistOptions<T> {
  id: string;
  storage: PersistStorage;
  paths?: PathOption<T>[];
  throttle?: Duration;
  persistInitialState?: boolean;
}

export class Persist<T> {
  readonly storage: PersistStorageWithListItems;
  readonly [Symbol.dispose]!: Cancel;

  readonly paths: {
    path: KeyType[];
    throttle?: number;
  }[];

  readonly initialized: Promise<void>;

  private resolveInitialized?: () => void;

  private channel: BroadcastChannel;

  private queue = queue();

  private handles = new Set<Cancel>();

  private stopped = false;

  private updateInProgress = new Map<string, unknown>();

  private prefix;

  constructor(
    public readonly store: Store<T>,
    public readonly options: PersistOptions<T>,
  ) {
    this.storage = normalizeStorage(options.storage);
    this.channel = new BroadcastChannel(`cross-state-persist_${options.id}`);
    this.prefix = `${options.id}:`;

    if (Symbol.dispose) {
      this[Symbol.dispose] = () => this.stop();
    }

    this.paths = (options.paths ?? [])
      .map<{
        path: KeyType[];
        throttle?: number;
      }>((p) => {
        if (isPlainPath(p)) {
          return {
            path: castArrayPath(p),
            throttle: options.throttle && calcDuration(options.throttle),
          };
        }

        const _p = p as { path: KeyType[]; throttle?: Duration };

        return {
          path: castArrayPath(_p.path),
          throttle:
            (_p.throttle && calcDuration(_p.throttle)) ??
            (options.throttle && calcDuration(options.throttle)),
        };
      })
      .sort((a, b) => b.path.length - a.path.length);

    if (this.paths.length === 0) {
      this.paths.push({
        path: ['*'],
        throttle: options.throttle && calcDuration(options.throttle),
      });
    }

    this.initialized = new Promise((resolve) => {
      this.resolveInitialized = resolve;
    });

    this.watchStore();
    this.watchStorage();
  }

  private watchStore() {
    const throttle = Math.min(...this.paths.map((p) => p.throttle ?? 0)) || undefined;

    const cancel = subscribePatches.apply(this.store as Store<unknown>, [
      (patches, reversePatches) => {
        let i = 0;
        for (const patch of patches) {
          const reversePatch = reversePatches[i++];

          const stringPath = JSON.stringify(patch.path);
          if (
            this.updateInProgress.has(stringPath) &&
            this.updateInProgress.get(stringPath) ===
              (patch.op === 'remove' ? undefined : patch.value)
          ) {
            continue;
          }

          const matchingPaths = this.paths.filter(
            (p) => isAncestor(p.path, patch.path) || isAncestor(patch.path, p.path),
          );

          for (const { path } of matchingPaths) {
            if (path.length <= patch.path.length) {
              const pathToSave = patch.path.slice(0, path.length);
              this.queue(() => this.save(pathToSave), pathToSave);
            } else if (patch.op === 'remove') {
              const subValues = split(
                reversePatch?.op === 'add' ? reversePatch.value : {},
                path.slice(patch.path.length),
              );

              for (const { path } of subValues) {
                this.queue(() => this.save([...patch.path, ...path]), [...patch.path, ...path]);
              }
            } else {
              const updatedValues = split(patch.value, path.slice(patch.path.length));
              const removedValues = split(
                reversePatch?.op !== 'remove' ? (reversePatch?.value ?? {}) : {},
                path.slice(patch.path.length),
              ).filter((v) => !updatedValues.some((u) => shallowEqual(u.path, v.path)));

              for (const { path } of updatedValues) {
                this.queue(() => this.save([...patch.path, ...path]), [...patch.path, ...path]);
              }
              for (const { path } of removedValues) {
                this.queue(() => this.save([...patch.path, ...path]), [...patch.path, ...path]);
              }
            }
          }
        }
      },
      { runNow: this.options.persistInitialState ?? false, passive: true, throttle },
    ]);

    this.handles.add(cancel);
  }

  private async watchStorage() {
    if (!this.options.persistInitialState) {
      let items = this.storage.listItems();
      if (isPromise(items)) {
        items = await items;
      }

      if (this.stopped) {
        return;
      }

      const toLoad = new Map(
        [...items.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([key, value]) => [this.parseKey(key), value])
          .filter(([key]) => key) as [Key, string][],
      );

      this.queue(() => this.load(toLoad));
    }

    this.queue(() => this.resolveInitialized?.());

    const listener = (event: MessageEvent) => {
      this.queue(() => this.load([{ type: 'data', path: event.data }]));
    };

    this.channel.addEventListener('message', listener);
    this.handles.add(() => this.channel.removeEventListener('message', listener));
  }

  private buildKey({ type, path }: Key) {
    return `${this.prefix}${type === 'internal' ? path : JSON.stringify(path)}`;
  }

  private parseKey(key: string): Key | undefined {
    if (!key.startsWith(this.prefix)) {
      return;
    }

    key = key.slice(this.prefix.length);

    if (!key.startsWith('[')) {
      return { type: 'internal', path: key };
    }

    return { type: 'data', path: JSON.parse(key) as KeyType[] };
  }

  private load(items: Key[] | Map<Key, string>): void | Promise<void> {
    return promiseChain(() => {
      if (Array.isArray(items)) {
        return promiseChain(() => {
          const entries = items.map(
            (key) =>
              promiseChain(() => {
                return this.storage.getItem(this.buildKey(key));
              }).next((value) => [key, value] as const).value,
          );

          return entries.some(isPromise)
            ? Promise.all(entries)
            : (entries as [Key, string | null][]);
        }).next((entries) => {
          return entries.filter((entry) => entry !== null) as [Key, string][];
        }).value;
      } else {
        return [...items.entries()];
      }
    }).next((entries) => {
      if (this.stopped) {
        return;
      }

      const toWrite = entries
        .filter(([key, value]) => {
          if (key.type !== 'data' || !value) {
            return;
          }

          if (
            !this.paths.find(
              (p) =>
                (p.path.length === 1 && p.path[0] === '*' && key.path.length === 0) ||
                (p.path.length === key.path.length && isAncestor(p.path, key.path)),
            )
          ) {
            return null;
          }

          const inSaveQueue = this.queue
            .getRefs()
            .find((ref) => isAncestor(ref, key.path) || isAncestor(key.path, ref));
          return !inSaveQueue;
        })
        .map(([key, value]) => {
          try {
            return {
              path: key.path,
              value: !value || value === 'undefined' ? undefined : fromExtendedJsonString(value),
            };
          } catch {
            return undefined;
          }
        })
        .filter(Boolean) as { path: KeyType[]; value: unknown }[];

      if (toWrite.length > 0) {
        for (const { path, value } of toWrite) {
          this.updateInProgress.set(JSON.stringify(path), value);
        }

        this.store.set((state) => {
          for (const { path, value } of toWrite) {
            if (value === undefined) {
              state = remove(state, path as any);
            } else {
              state = set(state, path as any, value);
            }
          }

          return state;
        });

        this.updateInProgress.clear();
      }

      const versionEntry = entries.find(
        ([key]) => key.type === 'internal' && key.path === 'version',
      );
      if (versionEntry) {
        this.store.version = versionEntry[1];
      }
    }).value;
  }

  private save(path: KeyType[]): void | Promise<unknown> {
    const key = this.buildKey({ type: 'data', path });
    const value = get(this.store.get() as any, path);

    return promiseChain(value)
      .next((value) => {
        if (value === undefined) {
          return this.storage.removeItem(key);
        } else {
          return this.storage.setItem(key, toExtendedJsonString(value));
        }
      })
      .next(() => {
        this.channel.postMessage(path);

        if (this.store.version) {
          return this.storage.setItem(
            this.buildKey({ type: 'internal', path: 'version' }),
            this.store.version,
          );
        } else {
          return this.storage.removeItem(this.buildKey({ type: 'internal', path: 'version' }));
        }
      }).value;
  }

  async stop(): Promise<void> {
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

function isPlainPath<T>(p: PathOption<T>): p is WildcardPath<T> & (KeyType[] | string) {
  return typeof p === 'string' || Array.isArray(p);
}
