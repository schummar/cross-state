import { maybeAsync, maybeAsyncArray } from '@lib/maybeAsync';

export interface PersistStorageBase {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => unknown | Promise<unknown>;
  removeItem: (key: string) => unknown | Promise<unknown>;
}

export interface PersistStorageWithKeys extends PersistStorageBase {
  keys: () => string[] | Promise<string[]>;
}

export interface PersistStorageWithLength extends PersistStorageBase {
  length: number | (() => number | Promise<number>);
  key: (keyIndex: number) => string | null | Promise<string | null>;
}

export type PersistStorage = PersistStorageBase &
  (PersistStorageWithKeys | PersistStorageWithLength);

export function normalizeStorage(storage: PersistStorage): PersistStorageWithKeys {
  return {
    getItem: storage.getItem.bind(storage),
    setItem: storage.setItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),

    keys(): string[] | Promise<string[]> {
      if ('keys' in storage) {
        return storage.keys();
      }

      return maybeAsync(
        storage.length instanceof Function ? storage.length() : storage.length,
        (length) => {
          const keyPromises = maybeAsyncArray(
            Array.from({ length }, (_, index) => () => storage.key(index)),
          );

          return maybeAsync(keyPromises, (keys) =>
            keys.filter((key): key is string => typeof key === 'string'),
          );
        },
      );
    },
  };
}
