import { useCallback, useDebugValue, useLayoutEffect, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/with-selector';
import type { Store } from '..';
import type { SubscribeOptions } from '../core/commonTypes';
import { hash } from '../lib/hash';
import { trackingProxy } from '../lib/trackingProxy';

export type UseStoreOptions = Omit<SubscribeOptions, 'runNow'>;

export function useStore<T>(store: Store<T>, options?: UseStoreOptions): T {
  const lastEqualsRef = useRef<(newValue: T) => boolean>();

  const subOptions = { ...options, runNow: false, equals: undefined };

  const subscribe = useCallback(
    (listener: () => void) => {
      return store.sub(listener, subOptions);
    },
    [store, hash(subOptions)]
  );

  const value = useSyncExternalStoreWithSelector(
    //
    subscribe,
    store.get,
    undefined,
    (x) => x,
    options?.equals ?? ((_v, newValue) => lastEqualsRef.current?.(newValue) ?? false)
  );
  const [proxiedValue, equals] = trackingProxy(value);

  useLayoutEffect(() => {
    lastEqualsRef.current = equals;
  });

  useDebugValue(value);
  return proxiedValue;
}
