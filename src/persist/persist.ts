import { computed } from '../core/computed';
import type { AtomicStore } from '../core/types';
import { queue } from '../lib/queue';
import type { PersistOptions } from './persistOptions';
import type { PersistStorage } from './persistStorage';

export function persist<T>(s: AtomicStore<T>, storage: PersistStorage, options: PersistOptions<T>) {
  const { id, throttle } = options;
  const paths = (Array.isArray(options.paths) ? options.paths : [options.paths ?? '']).map((path) => path.split('.').filter(Boolean));
  paths.sort((a, b) => a.length - b.length);

  let canceled = false;
  const handles: (() => void)[] = [];
  const q = queue();

  const init = async () => {
    const storageKey = await getStorageKeys(storage);
    let value: any = {};
    let i = 1;

    for (const path of paths) {
      const cutPaths = paths
        .slice(i++)
        .filter((other) => path.every((p, i) => other[i] === p))
        .map((other) => other.slice(path.length));
      console.log({ path, cutPaths });

      const pattern = new RegExp(path.join('_').replace(/\*/g, '[^_]*'));
      const matches = storageKey.filter(pattern.test);

      for (const key of matches) {
        try {
          const serialized = await storage.getItem(key);
          if (serialized !== null) {
            const parsed = serialized === 'undefined' ? undefined : JSON.parse(serialized);
            value = set(value, path, parsed);
          }
        } catch (e) {
          if (options.onError) {
            options.onError(e, 'save');
          } else {
            console.error('Failed to restore store persist:', e);
          }
        }

        if (canceled) {
          return;
        }
      }

      const part = computed((use) => {
        let value = get(use(s), path);
        for (const cut of cutPaths) {
          value = set(value, cut, undefined);
        }
        return value;
      });
      const handle = part.subscribe(
        async (value) => {
          try {
            await q(() => storage.setItem(partId, JSON.stringify(value)));
          } catch (e) {
            console.error('Failed to save store persist:', e);
          }
        },
        {
          throttle,
          runNow: false,
        }
      );

      handles.push(handle);
    }

    s.set(value);
  };

  const hydrated = init();

  const stop = () => {
    canceled = true;
    for (const handle of handles) {
      handle?.();
    }
    q.clear();
  };

  return {
    hydrated,
    stop,
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

function set<T>(obj: T, [first, ...rest]: string[], value: unknown): T {
  if (!first) {
    return obj;
  }

  if (rest.length > 0) {
    return { ...obj, [first]: set((obj as any)[first] ?? {}, rest, value) };
  } else {
    return { ...obj, [first]: value };
  }
}

function get<T>(obj: T, [first, ...rest]: string[]): unknown {
  if (!first) {
    return obj;
  }

  return get((obj as any)?.[first], rest);
}
