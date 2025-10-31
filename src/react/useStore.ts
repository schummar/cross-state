import type { Selector, SubscribeOptions } from '@core/commonTypes';
import type { Store } from '@core/store';
import type { Constrain } from '@lib/constrain';
import { deepEqual, strictEqual } from '@lib/equals';
import { makeSelector } from '@lib/makeSelector';
import { isAnyPath, type AnyPath, type Path, type Value } from '@lib/path';
import { trackingProxy } from '@lib/trackingProxy';
import useMemoEquals from '@react/lib/useMemoEquals';
import {
  useCallback,
  useDebugValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

export interface UseStoreOptions<T> extends Omit<SubscribeOptions, 'runNow' | 'passive'> {
  /**
   * If true, the cache content can be consumed but no fetch will be triggered.
   * @default false
   */

  passive?: boolean;

  /**
   * (experimental) If true, the a rerender will only be triggered when a property of the returned value changes that was
   * actually accessed during the last render.
   * @default false
   */
  enableTrackingProxy?: boolean;

  /**
   * (experimental) If provided, a rerender will be wrapped in a browser view transition.
   */
  withViewTransition?: boolean | ((value: T) => unknown);
}

export interface UseStoreOptionsWithSelector<T, S> extends UseStoreOptions<S> {
  /**
   * Equality function to compare the raw store values before reevaluating the selector.
   * Can be used to avoid unnecessary selector evaluations.
   * @default strictEqual
   */
  storeValueEquals?: (newValue: T, oldValue: T) => boolean;
}

export function useStore<T, S>(
  store: Store<T>,
  selector: Selector<T, S>,
  option?: UseStoreOptionsWithSelector<T, S>,
): S;

export function useStore<T, const P>(
  store: Store<T>,
  selector: Constrain<P, Path<T>>,
  option?: UseStoreOptionsWithSelector<T, Value<T, P>>,
): Value<T, P>;

export function useStore<T>(store: Store<T>, option?: UseStoreOptions<T>): T;

export function useStore<T, S>(
  store: Store<T>,
  ...args:
    | [Selector<T, S> | AnyPath, UseStoreOptionsWithSelector<T, S>?]
    | [UseStoreOptionsWithSelector<T, S>?]
): S {
  let selectorRaw: Selector<T, S> | AnyPath | undefined;
  let allOptions: UseStoreOptionsWithSelector<T, S>;

  if (typeof args[0] === 'function' || isAnyPath(args[0])) {
    selectorRaw = args[0];
    allOptions = args[1] ?? {};
  } else {
    allOptions = args[0] ?? {};
  }

  const selectorMemoized = useMemoEquals(selectorRaw);
  const selector = useMemo(() => makeSelector<T, S>(selectorMemoized), [selectorMemoized]);
  const lastEqualsRef = useRef<(newValue: S) => boolean | undefined>(undefined);

  const {
    enableTrackingProxy,
    equals = store.options.equals ?? deepEqual,
    withViewTransition,
    storeValueEquals = strictEqual,
    ...options
  } = allOptions;

  const snapshot = useRef<{ storeValue: T; selector: (value: T) => S; selectedValue: S }>(
    undefined,
  );

  const get = useCallback(() => {
    const storeValue = store.get();

    if (
      snapshot.current &&
      storeValueEquals(storeValue, snapshot.current.storeValue) &&
      selector === snapshot.current.selector
    ) {
      return snapshot.current.selectedValue;
    }

    const selectedValue = selector(storeValue);
    if (!(lastEqualsRef.current?.(selectedValue) ?? false)) {
      snapshot.current = { storeValue, selector, selectedValue };
    }

    return snapshot.current!.selectedValue;
  }, [store, storeValueEquals, selector]);

  const rootStore = store.derivedFrom?.store ?? store;
  const subOptions = useMemoEquals({ ...options, runNow: false });

  const subscribe = useCallback(
    (listener: () => void) => {
      let _listener: (value: any) => void = listener;
      let stopped = false;

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
            mutationObserver.disconnect();

            if (!stopped) {
              listener();
            }

            if (!hasChanges) {
              throw new Error('no change');
            }
          });
        };
      }

      const cancel = rootStore.subscribe(_listener, subOptions);
      return () => {
        stopped = true;
        cancel();
      };
    },
    [rootStore, withViewTransition, equals, subOptions],
  );

  let value = useSyncExternalStore<S>(subscribe, get, get);
  let lastEquals = (newValue: S) => equals(newValue, value);
  let revoke: (() => void) | undefined;

  if (enableTrackingProxy) {
    [value, lastEquals, revoke] = trackingProxy(value, equals);
  }

  useLayoutEffect(() => {
    lastEqualsRef.current = lastEquals;
    revoke?.();
  });

  useDebugValue(value);
  return value;
}
