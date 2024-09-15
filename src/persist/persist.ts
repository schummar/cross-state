import { type Cancel, type Store } from '@core';
import { diff } from '@lib/diff';
import { shallowEqual } from '@lib/equals';
import isPromise from '@lib/isPromise';
import { maybeAsync, maybeAsyncArray } from '@lib/maybeAsync';
import type { KeyType, WildcardPath } from '@lib/path';
import { castArrayPath, get, set } from '@lib/propAccess';
import { queue } from '@lib/queue';
import { isAncestor } from './persistPathHelpers';
import {
  normalizeStorage,
  type PersistStorage,
  type PersistStorageWithKeys,
} from './persistStorage';

type PathOption<T> =
  | WildcardPath<T>
  | {
      path: WildcardPath<T>;
      throttleMs?: number;
    };

type Key = { type: 'internal'; path: string } | { type: 'data'; path: KeyType[] };

export interface PersistOptions<T> {
  id: string;
  storage: PersistStorage;
  paths?: PathOption<T>[];
  throttleMs?: number;
}

export class Persist<T> {
  readonly storage: PersistStorageWithKeys;

  readonly paths: {
    path: KeyType[];
    throttleMs?: number;
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

    this.paths = (options.paths ?? [])
      .map<{
        path: KeyType[];
        throttleMs?: number;
      }>((p) => {
        if (isPlainPath(p)) {
          return { path: castArrayPath(p) };
        }

        const _p = p as { path: KeyType[]; throttleMs?: number };

        return {
          path: castArrayPath(_p.path),
          throttleMs: _p.throttleMs,
        };
      })
      .sort((a, b) => b.path.length - a.path.length);

    if (this.paths.length === 0) {
      this.paths.push({ path: ['*'] });
    }

    this.initialized = new Promise((resolve) => {
      this.resolveInitialized = resolve;
    });

    this.watchStore();
    this.watchStorage();
  }

  private watchStore() {
    let committed = this.store.get();

    const cancel = this.store.subscribe(
      (value) => {
        const [patches] = diff(committed, value);
        committed = value;

        for (const patch of patches) {
          if (
            this.updateInProgress &&
            shallowEqual(this.updateInProgress[0], patch.path) &&
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

  private async watchStorage() {
    let keys = this.storage.keys();
    if (isPromise(keys)) {
      keys = await keys;
    }

    if (this.stopped) {
      return;
    }

    for (const key of keys) {
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

  private load({ type, path }: Key) {
    if (type === 'internal') {
      switch (path) {
        case 'version':
          return maybeAsync(this.storage.getItem(`${this.prefix}:version`), (value) => {
            this.store.version = value || undefined;
          });
        default:
          return;
      }
    }

    const matchingPath = this.paths.find(
      (p) => p.path.length === path.length && isAncestor(p.path, path),
    );
    if (!matchingPath) {
      return;
    }

    const key = this.buildKey({ type: 'data', path });

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
      this.store.set((state) => set(state, path as any, parsedValue));
      this.updateInProgress = undefined;
    });
  }

  private save(path: KeyType[]) {
    const key = this.buildKey({ type: 'data', path });
    const value = get(this.store.get(), path as any);
    const serializedValue = value === undefined ? 'undefined' : JSON.stringify(value);

    return maybeAsync(this.storage.setItem(key, serializedValue), () => {
      this.channel.postMessage(path);

      return maybeAsync(
        this.store.version
          ? this.storage.setItem(`${this.prefix}:version`, this.store.version ?? '')
          : this.storage.removeItem(`${this.prefix}:version`),
        () => {
          return maybeAsync(this.storage.keys(), (keys) => {
            const toRemove = keys.filter((k) => {
              const parsedKey = this.parseKey(k);
              return (
                parsedKey?.type === 'data' &&
                parsedKey.path.length > path.length &&
                isAncestor(path, parsedKey.path)
                // !this.queue.getRefs().find((ref) => isAncestor(ref, parsedKey))
              );
            });

            return maybeAsyncArray(toRemove.map((k) => () => this.storage.removeItem(k)));
          });
        },
      );
    });
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
