import { type Cancel, type Duration, type Store } from '@core';
import { calcDuration } from '@lib/calcDuration';
import { shallowEqual } from '@lib/equals';
import isPromise from '@lib/isPromise';
import type { KeyType, WildcardPath } from '@lib/path';
import { castArrayPath, get, remove, set } from '@lib/propAccess';
import { queue } from '@lib/queue';
import { patchMethods } from '@patches';
import { isAncestor, split } from './persistPathHelpers';
import {
  normalizeStorage,
  type PersistStorage,
  type PersistStorageWithKeys,
} from './persistStorage';
import { fromExtendedJsonString, toExtendedJsonString } from '@lib/extendedJson';

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
}

export class Persist<T> {
  readonly storage: PersistStorageWithKeys;
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

  private updateInProgress?: [any, any];

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

    const cancel = patchMethods.subscribePatches.apply(this.store as Store<unknown>, [
      (patches, reversePatches) => {
        let i = 0;
        for (const patch of patches) {
          const reversePatch = reversePatches[i++];

          if (
            this.updateInProgress &&
            shallowEqual(this.updateInProgress[0], patch.path) &&
            this.updateInProgress[1] === (patch.op === 'remove' ? undefined : patch.value)
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
                reversePatch?.op !== 'remove' ? reversePatch?.value : {},
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
      { runNow: false, throttle },
    ]);

    this.handles.add(cancel);
  }

  private async watchStorage() {
    let keys = this.storage.keys();
    if (isPromise(keys)) {
      keys = await keys;
    }

    if (this.stopped) {
      return;
    }

    const sortedKeys = keys.sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
      const path = this.parseKey(key);
      if (!path) {
        continue;
      }

      this.queue(() => this.load(path));
    }

    this.queue(() => this.resolveInitialized?.());

    const listener = (event: MessageEvent) => {
      this.queue(() => this.load({ type: 'data', path: event.data }));
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

  private load({ type, path }: Key): void | Promise<void> {
    if (type === 'internal') {
      switch (path) {
        case 'version':
          return chain(
            this.storage.getItem(this.buildKey({ type: 'internal', path: 'version' })),
          ).then((value) => {
            this.store.version = value || undefined;
          }).value;
      }

      return;
    }

    const matchingPath = this.paths.find(
      (p) => p.path.length === path.length && isAncestor(p.path, path),
    );
    if (!matchingPath) {
      return;
    }

    const key = this.buildKey({ type: 'data', path });

    return chain(this.storage.getItem(key)).then((value) => {
      if (this.stopped) {
        return;
      }

      const inSaveQueue = this.queue
        .getRefs()
        .find((ref) => isAncestor(ref, path) || isAncestor(path, ref));
      if (inSaveQueue) {
        return;
      }

      const parsedValue =
        !value || value === 'undefined' ? undefined : fromExtendedJsonString(value);

      this.updateInProgress = [path, parsedValue];

      console.log('set', path);

      if (parsedValue === undefined) {
        this.store.set((state) => remove(state, path as any));
      } else {
        this.store.set((state) => set(state, path as any, parsedValue));
      }

      this.updateInProgress = undefined;
    }).value;
  }

  private save(path: KeyType[]): void | Promise<unknown> {
    const key = this.buildKey({ type: 'data', path });
    const value = get(this.store.get() as any, path);

    return chain(value)
      .then((value) => {
        if (value === undefined) {
          return this.storage.removeItem(key);
        } else {
          return this.storage.setItem(key, toExtendedJsonString(value));
        }
      })
      .then(() => {
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

interface Chain<T> {
  value: T;
  then<S>(fn: (value: Awaited<T>) => S): T extends Promise<any> ? Chain<Promise<S>> : Chain<S>;
}

function chain<T>(value: T): Chain<T> {
  return {
    value,
    then(fn) {
      const next = isPromise(value)
        ? value.then((value) => fn(value as Awaited<T>))
        : fn(value as Awaited<T>);

      return chain(next) as any;
    },
  };
}
