import type { Selector, SubscribeOptions } from '@core/commonTypes';
import type { Store } from '@core/store';
import { deepEqual } from '@lib/equals';
import { hash } from '@lib/hash';
import { makeSelector } from '@lib/makeSelector';
import { type Path, type Value } from '@lib/path';
import { trackingProxy } from '@lib/trackingProxy';
import { useCallback, useDebugValue, useLayoutEffect, useMemo, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector.js';

export interface UseStoreOptions<S> extends Omit<SubscribeOptions, 'runNow' | 'passive'> {
  /**
   * If true, the cache content can be consumed but no fetch will be triggered.
   * @default false
   */
  passive?: boolean;

  disableTrackingProxy?: boolean;

  withViewTransition?: boolean | ((value: S) => unknown);
}

export function useStore<T, S>(
  store: Store<T>,
  selector: Selector<T, S>,
  option?: UseStoreOptions<S>,
): S;

export function useStore<T, P extends Path<T>>(
  store: Store<T>,
  selector: P,
  option?: UseStoreOptions<Value<T, P>>,
): Value<T, P>;

export function useStore<T>(store: Store<T>, option?: UseStoreOptions<T>): T;

export function useStore<T, S>(store: Store<T>, argument1?: any, argument2?: any): S {
  const selector = makeSelector<T, S>(
    typeof argument1 === 'function' || typeof argument1 === 'string' ? argument1 : undefined,
  );
  const allOptions = (
    typeof argument1 === 'object' ? argument1 : (argument2 ?? {})
  ) as UseStoreOptions<S>;

  const lastEqualsRef = useRef<(newValue: S) => boolean>();

  if (store.derivedFrom) {
    return useStore(
      store.derivedFrom.store,
      (value) => {
        for (const selector of store.derivedFrom!.selectors) {
          value = makeSelector(selector)(value);
        }
        return value;
      },
      allOptions,
    );
  }

  const {
    disableTrackingProxy = true,
    equals = store.options.equals ?? deepEqual,
    withViewTransition,
    ...options
  } = allOptions;

  const subOptions = { ...options, runNow: false };
  const subscribe = useCallback(
    (listener: () => void) => {
      let _listener: (value: any) => void = listener;

      if (withViewTransition && (document as any).startViewTransition) {
        let lastObservedValue: any;

        _listener = (value: any) => {
          const observedValue =
            withViewTransition instanceof Function ? withViewTransition(value) : value;

          if (equals(lastObservedValue, observedValue)) {
            listener();
            return;
          }

          lastObservedValue = observedValue;

          let hasChanges = false;
          const mutationObserver = new MutationObserver(() => {
            hasChanges = true;
            mutationObserver.disconnect();
          });
          mutationObserver.observe(document.body, { childList: true, subtree: true });

          (document as any).startViewTransition(() => {
            listener();

            if (!hasChanges) {
              throw new Error('no change');
            }
          });
        };
      }

      return store.subscribe(_listener, subOptions);
    },
    [store, hash(subOptions)],
  );

  let value = useSyncExternalStoreWithSelector<T, S>(
    //
    subscribe,
    store.get,
    undefined,
    (x) => selector(x),
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
