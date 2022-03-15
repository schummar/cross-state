import { useCallback, useDebugValue } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { Store, SubscribeOptions } from '../commonTypes';
import { shallowEquals } from '../equals';

export type UseStoreOptions = Omit<SubscribeOptions, 'runNow'>;

export function useStore<T>(store: Store<T>, options?: UseStoreOptions): T;
export function useStore<T, S>(store: Store<T>, selector: (value: T) => S, options?: UseStoreOptions): S;
export function useStore<T, S = T>(
  store: Store<T>,
  ...[selector, options]: [options?: UseStoreOptions] | [selector: (value: T) => S, options?: UseStoreOptions]
): S {
  if (!selector || !(selector instanceof Function)) {
    options = selector;
    selector = (x) => x as any;
  }

  const subscribe = useCallback(
    (listener: () => void) => {
      return store.subscribe(listener, { ...options, runNow: false });
    },
    [store, options?.throttle, options?.equals]
  );

  const getSnapshot = useCallback(() => store.get(), [store]);

  const value = useSyncExternalStoreWithSelector(
    //
    subscribe,
    getSnapshot,
    getSnapshot,
    selector,
    options?.equals ?? shallowEquals
  );

  useDebugValue(value);
  return value;
}
