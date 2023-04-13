import { useCallback, useDebugValue, useLayoutEffect, useMemo, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector.js';
import type { SubscribeOptions } from '@core/commonTypes';
import type { Store } from '@core/store';
import { deepEqual } from '@lib/equals';
import { hash } from '@lib/hash';
import { makeSelector } from '@lib/makeSelector';
import { trackingProxy } from '@lib/trackingProxy';

export interface UseStoreOptions extends Omit<SubscribeOptions, 'runNow' | 'passive'> {
  disableTrackingProxy?: boolean;
}

export function useStore<T>(
  store: Store<T>,
  { disableTrackingProxy, equals = deepEqual, ...options }: UseStoreOptions = {},
): T {
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

  const subOptions = { ...options, runNow: false, passive: false };
  const subscribe = useCallback(
    (listener: () => void) => {
      return rootStore.subscribe(listener, subOptions);
    },
    [rootStore, hash(subOptions)],
  );

  let value = useSyncExternalStoreWithSelector<unknown, T>(
    //
    subscribe,
    rootStore.get,
    undefined,
    selector,
    (_v, newValue) => lastEqualsRef.current?.(newValue) ?? false,
  );
  let lastEquals = (newValue: T) => equals(newValue, value);
  let revoke: (() => void) | undefined;

  if (!disableTrackingProxy) {
    [value, lastEquals, revoke] = trackingProxy(value, equals);
  }

  useLayoutEffect(() => {
    lastEqualsRef.current = lastEquals;
    revoke?.();
  });

  useDebugValue(value);
  return value;
}
