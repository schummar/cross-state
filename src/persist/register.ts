import { Store } from '@core';
import { persist, type Persist, type PersistOptions } from '@persist/persist';

declare module '..' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface StoreOptions<T> {
    persist?: PersistOptions<T>;
  }

  interface Store<T> {
    persistance?: Persist<T>;
  }
}

Store.addHook((store) => {
  if (store.options.persist) {
    store.persistance = persist(store, store.options.persist);
  }
});
