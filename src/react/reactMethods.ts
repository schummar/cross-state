import { useProp } from './useProp';
import { type UseStoreOptions, useStore } from './useStore';
import type { Store } from '@core/store';

export const reactMethods = {
  useStore<T>(this: Store<T>, options?: UseStoreOptions) {
    return useStore(this, options);
  },

  useProp<T>(this: Store<T>, options?: UseStoreOptions) {
    return useProp(this, options);
  },
};
