import { useCallback, useDebugValue, useLayoutEffect, useMemo, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector.js';
import type { SubscribeOptions } from '@core/commonTypes';
import type { Store } from '@core/store';
import { hash } from '@lib/hash';
import { makeSelector } from '@lib/makeSelector';
import { trackingProxy } from '@lib/trackingProxy';

export type UseStoreOptions = Omit<SubscribeOptions, 'runNow' | 'passive'>;

export function useStore<T>(store: Store<T>, options?: UseStoreOptions): T {
  const lastEqualsRef = useRef<(newValue: T) => boolean>();

  const { rootStore, selector } = useMemo(() => {
    const rootStore = store.derivedFrom?.store ?? store;
    let selector = (x: any) => x;

    if (store.derivedFrom) {
      selector = (value: any) => {
        for (const s of store.derivedFrom!.selectors) {
          value = makeSelector(s)(value);
        }
        return value;
      };
    }

    return { rootStore, selector };
  }, [store]);

  const subOptions = { ...options, runNow: false, equals: undefined, passive: false };
  const subscribe = useCallback(
    (listener: () => void) => {
      return rootStore.subscribe(listener, subOptions);
    },
    [rootStore, hash(subOptions)],
  );

  const value = useSyncExternalStoreWithSelector<unknown, T>(
    //
    subscribe,
    rootStore.get,
    undefined,
    selector,
    options?.equals ?? ((_v, newValue) => lastEqualsRef.current?.(newValue) ?? false),
  );
  const [proxiedValue, equals] = trackingProxy(value);

  useLayoutEffect(() => {
    lastEqualsRef.current = equals;
  });

  useDebugValue(value);
  return proxiedValue;
}
