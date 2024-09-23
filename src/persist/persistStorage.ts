import isPromise from '@lib/isPromise';
import promiseChain from '@lib/promiseChain';

export interface PersistStorageBase {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<unknown>;
  removeItem: (key: string) => void | Promise<unknown>;
}

export interface PersistStorageWithKeys extends PersistStorageBase {
  keys: () => string[] | Promise<string[]>;
}

export interface PersistStorageWithLength extends PersistStorageBase {
  length: number | (() => number | Promise<number>);
  key: (keyIndex: number) => string | null | Promise<string | null>;
}

export interface PersistStorageWithListItems extends PersistStorageBase {
  listItems: () => Map<string, string> | Promise<Map<string, string>>;
}

export type PersistStorage =
  | PersistStorageWithKeys
  | PersistStorageWithLength
  | PersistStorageWithListItems;

export function normalizeStorage(storage: PersistStorage): PersistStorageWithListItems {
  return {
    getItem: storage.getItem.bind(storage),
    setItem: storage.setItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),

    listItems() {
      if ('listItems' in storage) {
        return storage.listItems();
      }

      return promiseChain(() => {
        if ('keys' in storage) {
          return storage.keys();
        } else {
          return promiseChain(
            storage.length instanceof Function ? storage.length() : storage.length,
          )
            .then((length) => {
              const keys = Array.from({ length }, (_, index) => storage.key(index));
              return keys.some(isPromise) ? Promise.all(keys) : (keys as (string | null)[]);
            })
            .then((keys) => {
              return keys.filter((key): key is string => typeof key === 'string');
            }).value;
        }
      })
        .then((keys) => {
          const results = keys.map(
            (key) =>
              promiseChain(storage.getItem(key)).then((value) => [key, value] as const).value,
          );

          return results.some(isPromise)
            ? Promise.all(results)
            : (results as [string, string | null][]);
        })
        .then((results) => {
          return new Map(results.filter(([, value]) => value !== null) as [string, string][]);
        }).value;
    },
  };
}
