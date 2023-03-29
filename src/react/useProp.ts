import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';
import type { Store } from '@core/store';

export function useProp<T>(
  store: Store<T>,
  options?: UseStoreOptions,
): [value: T, setValue: typeof store.set] {
  const value = useStore(store, options);

  return [value, store.set];
}
