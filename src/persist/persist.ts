import type { AtomicStore } from '../core/atomicStore';
import type { Cancel, Listener, Store } from '../core/commonTypes';
import { simpleDeepEquals } from '../lib/equals';
import { forwardError } from '../lib/forwardError';
import { get, set } from '../lib/propAccess';
import type { Queue } from '../lib/queue';
import { queue } from '../lib/queue';
import type { PersistOptions } from './persistOptions';
import type { PersistStorage } from './persistStorage';

export interface PersistPatch {
  op: 'replace' | 'remove' | 'add';
  path: (string | number)[];
  value?: any;
}

export interface PersistedStore<T> extends AtomicStore<T> {
  subscribePatches?: (listener: Listener<PersistPatch[]>) => Cancel;
}

export function persist<T>(store: AtomicStore<T>, storage: PersistStorage, options: PersistOptions<T>) {
  // Sort paths, so that shortest path are always processed first => sub paths overwrite their part after the parent path has written its
  const paths = (Array.isArray(options.paths) ? options.paths : [options.paths ?? '']).filter(validPath);
  paths.sort((a, b) => a.length - b.length);

  let isStopped = false;
  const handles: (() => void)[] = [];
  const saveQueue = queue();

  const init = async () => {
    // First, load
    const restored = await load(storage, paths, options);
    if (isStopped) {
      return;
    }

    // Apply loaded data to store
    store.update((state) => {
      for (const [key, value] of restored) {
        if (key === '') {
          state = value;
        } else {
          state = set(state as any, key, value);
        }
      }
      return state;
    });

    // Then start watching for changes
    save(store, storage, paths, options, handles, restored, saveQueue);
  };

  return {
    hydrated: init(),

    allSaved() {
      return saveQueue.whenDone;
    },

    stop() {
      isStopped = true;
      for (const handle of handles) {
        handle?.();
      }
    },
  };
}

async function getStorageKeys(storage: PersistStorage) {
  let keys;
  if ('keys' in storage) {
    const pKeys = storage.keys();
    keys = pKeys instanceof Promise ? await pKeys : pKeys;
  } else {
    keys = [];

    let length = storage.length instanceof Function ? storage.length() : storage.length;
    if (length instanceof Promise) {
      length = await length;
    }

    for (let i = 0; i < length; i++) {
      let key = storage.key(i);
      if (key instanceof Promise) {
        key = await key;
      }

      if (typeof key === 'string') {
        keys.push(key);
      }
    }
  }

  return keys;
}

const validPath = (path: string) => !path.match(/\*.|[^.]\*/);
const sanitizeRegex = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

async function load(storage: PersistStorage, paths: string[], options: PersistOptions<any>) {
  const result = new Map<string, any>();
  let storageKeys;

  try {
    storageKeys = await getStorageKeys(storage);
  } catch (e) {
    forwardError(e);
    return result;
  }

  for (const path of paths) {
    const prefix = path ? `${options.id}_` : options.id;
    const pattern = new RegExp(`^${sanitizeRegex(prefix)}${sanitizeRegex(path).replace('\\*', '[^.]+')}$`);
    const matches = storageKeys.filter((key) => pattern.test(key));

    for (const key of matches) {
      try {
        const serialized = await storage.getItem(key);

        if (serialized !== null) {
          const parsed = serialized === 'undefined' ? undefined : JSON.parse(serialized);

          result.set(key.slice(prefix.length), parsed);
        }
      } catch (e) {
        forwardError(e);
      }
    }
  }

  return result;
}

function save(
  store: Store<any>,
  storage: PersistStorage,
  paths: string[],
  options: PersistOptions<any>,
  handles: (() => void)[],
  restored: Map<string, any>,
  q: Queue
) {
  let i = 1;

  for (const path of paths) {
    const prefix = path && `${path}.`;
    const subPaths = paths
      .slice(i++)
      .filter((other) => other.startsWith(prefix))
      .map((other) => other.slice(prefix.length));

    const isWildcard = path.endsWith('.*');
    const observedPath = path.replace('.*', '');

    let firstCallback = true;
    const handle = store.subscribe(
      (state) => (observedPath === '' ? state : get(state, observedPath)),
      (partValue) => {
        const saveValues: [string, any][] = isWildcard ? Object.entries(partValue) : [['', partValue]];

        for (const [name, value] of saveValues) {
          q(async () => {
            const savePath = [observedPath, name].filter(Boolean).join('.');
            const saveKey = [options.id, savePath].filter(Boolean).join('_');
            const cutValue = subPaths.reduce((value, subPath) => cut(value, subPath), value);

            if (firstCallback && simpleDeepEquals(restored.get(savePath), cutValue)) {
              // Still same value as when loaded => no need to save again
              return;
            }
            firstCallback = false;

            const serialized = JSON.stringify(cutValue);
            try {
              const result = storage.setItem(saveKey, serialized);
              if (result instanceof Promise) {
                await result;
              }
            } catch (e) {
              forwardError(e);
            }
          });
        }
      },
      {
        throttle: options.throttle,
      }
    );
    handles.push(handle);
  }
}

function cut(obj: Record<string, unknown>, path: string): unknown {
  const index = path.indexOf('.');

  if (index >= 0) {
    const key = path.slice(0, index);
    const rest = path.slice(index + 1);
    const subObj = obj[key as any];

    if (!subObj) {
      return obj;
    }

    return {
      ...obj,
      [key]: cut(subObj as Record<string, unknown>, rest),
    };
  }

  if (path === '*') {
    return {};
  }

  const copy = { ...obj };
  delete copy[path];
  return copy;
}
