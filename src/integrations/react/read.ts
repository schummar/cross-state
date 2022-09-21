import { useCallback, useDebugValue, useLayoutEffect, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { AsyncStore } from '../../core/asyncStore';
import type { Store, SubscribeOptions } from '../../core/types';
import { makeSelector } from '../../lib/makeSelector';
import type { Path, Value } from '../../lib/propAccess';
import { trackingProxy } from '../../lib/trackingProxy';
import { useStoreScope } from './storeScope';

export type UseStoreOptions = Omit<SubscribeOptions, 'runNow'>;

export function read<V, Args extends any[]>(store: AsyncStore<V, Args>, options?: UseStoreOptions): V;
export function read<V, Args extends any[], S>(store: AsyncStore<V, Args>, selector: (value: V) => S, options?: UseStoreOptions): S;
export function read<V, Args extends any[], P extends Path<V>>(
  store: AsyncStore<V, Args>,
  selector: P,
  options?: UseStoreOptions
): Value<V, P>;
export function read<V, Args extends any[], S = V>(
  store: AsyncStore<V, Args>,
  ...[arg1, arg2]: [options?: UseStoreOptions] | [selector: (value: V) => S, options?: UseStoreOptions]
): S {
  store = useStoreScope(store);
  const selector = makeSelector<V, S>(arg1 instanceof Function || typeof arg1 === 'string' ? arg1 : undefined);
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

function usePromise<T>(p: Promise<T>) {
  const;
}
