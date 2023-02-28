import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';
import type { Store } from '@core/store';
import type { UpdateFunction } from '@core/commonTypes';

export function useProp<T>(
  store: Store<T>,
  options?: UseStoreOptions,
): [value: T, setValue: UpdateFunction<T>] {
  const value = useStore(store, options);

  return [value, store.set];
}
