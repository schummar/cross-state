import { useCallback, useDebugValue, useLayoutEffect, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import type { Store, SubscribeOptions } from '../../core/types';
import { trackingProxy } from '../../lib/trackingProxy';
import { useStoreContext } from './storeContext';

export type UseStoreOptions = Omit<SubscribeOptions, 'runNow'>;

export function useStore<T>(store: Store<T>, options?: UseStoreOptions): T;
export function useStore<T, S>(store: Store<T>, selector: (value: T) => S, options?: UseStoreOptions): S;
export function useStore<T, S = T>(
  store: Store<T>,
  ...[selector, options]: [options?: UseStoreOptions] | [selector: (value: T) => S, options?: UseStoreOptions]
): S {
  store = useStoreContext(store);

  if (!selector || !(selector instanceof Function)) {
    options = selector;
    selector = (x) => x as any;
  }

  const lastEqualsRef = useRef<(newValue: S) => boolean>();

  const subscribe = useCallback(
    (listener: () => void) => {
      return store.subscribe(listener, { ...options, runNow: false });
    },
    [store, options?.throttle, options?.equals]
  );

  const value = useSyncExternalStoreWithSelector(
    //
    subscribe,
    store.get,
    undefined,
    selector,
    options?.equals ?? ((_v, newValue) => lastEqualsRef.current?.(newValue) ?? false)
  );
  const [proxiedValue, equals] = trackingProxy(value);

  useLayoutEffect(() => {
    lastEqualsRef.current = equals;
  });

  useDebugValue(value);
  return proxiedValue;
}
