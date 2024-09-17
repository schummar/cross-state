import isPromise from '@lib/isPromise';

export interface PersistStorageBase {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
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

      const loadKey = (index: number) => storage.key(index);

      const length = storage.length instanceof Function ? storage.length() : storage.length;
      return isPromise(length) ? length.then(continueWithLength) : continueWithLength(length);

      function continueWithLength(length: number) {
        const keys = Array.from({ length }, (_, index) => loadKey(index));
        return keys.some(isPromise)
          ? Promise.all(keys).then(continueWithKeys)
          : continueWithKeys(keys as (string | null)[]);
      }

      function continueWithKeys(keys: (string | null)[]) {
        return keys.filter((key): key is string => typeof key === 'string');
      }
    },
  };
}
