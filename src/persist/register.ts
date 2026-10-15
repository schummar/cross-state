import { Store } from '@core';
import { Persist, type PersistOptions } from '@persist/persist';

declare module '..' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface StoreOptions<T> {
    /** Paths given here are not checked against `T`; `persist()` checks them. */
    persist?: PersistOptions;
  }

  interface Store<T> {
    persistance?: Persist<T>;
  }
}

Store.addHook((store) => {
  if (store.options.persist) {
    store.persistance = new Persist(store, store.options.persist);
  }
});
