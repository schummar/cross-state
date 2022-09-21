import { useCallback, useDebugValue, useLayoutEffect, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import type { Store, SubscribeOptions } from '../../core/commonTypes';
import { makeSelector } from '../../lib/makeSelector';
import type { Path, Value } from '../../lib/propAccess';
import { trackingProxy } from '../../lib/trackingProxy';
import { useStoreScope } from './storeScope';

export type UseStoreOptions = Omit<SubscribeOptions, 'runNow'>;

export function useStore<T>(store: Store<T>, options?: UseStoreOptions): T;
export function useStore<T, S>(store: Store<T>, selector: (value: T) => S, options?: UseStoreOptions): S;
export function useStore<T, P extends Path<T>>(store: Store<T>, selector: P, options?: UseStoreOptions): Value<T, P>;
export function useStore<T, S = T>(
  store: Store<T>,
  ...[arg1, arg2]: [options?: UseStoreOptions] | [selector: (value: T) => S, options?: UseStoreOptions]
): S {
  store = useStoreScope(store);
  const selector = makeSelector<T, S>(arg1 instanceof Function || typeof arg1 === 'string' ? arg1 : undefined);
  const options = arg1 instanceof Function || typeof arg1 === 'string' ? arg2 : arg1;

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
