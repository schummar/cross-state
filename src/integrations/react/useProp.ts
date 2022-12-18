import type { Store } from '@core/store';
import type { UpdateFn } from '../../core/commonTypes';
import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';

export function useProp<T>(store: Store<T>, options?: UseStoreOptions): [value: T, setValue: UpdateFn<T>] {
  const value = useStore(store, options);

  return [value, store.update];
}
