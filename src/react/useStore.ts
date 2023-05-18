import { useCallback, useDebugValue, useLayoutEffect, useMemo, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector.js';
import type { Selector, SubscribeOptions } from '@core/commonTypes';
import type { Store } from '@core/store';
import { deepEqual } from '@lib/equals';
import { hash } from '@lib/hash';
import { makeSelector } from '@lib/makeSelector';
import { trackingProxy } from '@lib/trackingProxy';
import { type Path, type Value } from '@lib/path';

export interface UseStoreOptions extends Omit<SubscribeOptions, 'runNow' | 'passive'> {
  disableTrackingProxy?: boolean;
}

export function useStore<T, S>(
  store: Store<T>,
  selector: Selector<T, S>,
  option?: UseStoreOptions,
): S;

export function useStore<T, P extends Path<T>>(
  store: Store<T>,
  selector: P,
  option?: UseStoreOptions,
): Value<T, P>;

export function useStore<T>(store: Store<T>, option?: UseStoreOptions): T;

export function useStore<T, S>(store: Store<T>, argument1?: any, argument2?: any): S {
  const selector = makeSelector<T, S>(
    typeof argument1 === 'function' || typeof argument1 === 'string' ? argument1 : undefined,
  );
  const {
    disableTrackingProxy = true,
    equals = deepEqual,
    ...options
  } = (typeof argument1 === 'object' ? argument1 : argument2 ?? {}) as UseStoreOptions;

  const lastEqualsRef = useRef<(newValue: S) => boolean>();

  const { rootStore, mappingSelector } = useMemo(() => {
    const rootStore = store.derivedFrom?.store ?? store;
    let mappingSelector = (x: any) => x;

    if (store.derivedFrom) {
      mappingSelector = (value: any) => {
        for (const s of store.derivedFrom!.selectors) {
          value = makeSelector(s)(value);
        }
        return value;
      };
    }

    return { rootStore, mappingSelector };
  }, [store]);

  const subOptions = { ...options, runNow: false, passive: false };
  const subscribe = useCallback(
    (listener: () => void) => {
      return rootStore.subscribe(listener, subOptions);
    },
    [rootStore, hash(subOptions)],
  );

  let value = useSyncExternalStoreWithSelector<unknown, S>(
    //
    subscribe,
    rootStore.get,
    undefined,
    (x) => selector(mappingSelector(x)),
    (_v, newValue) => lastEqualsRef.current?.(newValue) ?? false,
  );
  let lastEquals = (newValue: S) => equals(newValue, value);
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
