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

    async keys(): Promise<string[]> {
      if ('keys' in storage) {
        return storage.keys();
      }

      let length = storage.length instanceof Function ? storage.length() : storage.length;

      if (length instanceof Promise) {
        length = await length;
      }

      const keys = new Array<string>();

      for (let i = 0; i < length; i++) {
        let key = storage.key(i);

        if (key instanceof Promise) {
          key = await key;
        }

        if (typeof key === 'string') {
          keys.push(key);
        }
      }

      return keys;
    },
  };
}
