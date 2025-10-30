import type { Selector, SubscribeOptions } from '@core/commonTypes';
import type { Store } from '@core/store';
import type { Constrain } from '@lib/constrain';
import { deepEqual } from '@lib/equals';
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

export function useStore<T, const P>(
  store: Store<T>,
  selector: Constrain<P, Path<T>>,
  option?: UseStoreOptions<Value<T, P>>,
): Value<T, P>;

export function useStore<T>(store: Store<T>, option?: UseStoreOptions<T>): T;

export function useStore<T, S>(
  store: Store<T>,
  ...args: [Selector<T, S> | AnyPath, UseStoreOptions<S>?] | [UseStoreOptions<S>?]
): S {
  let selectorRaw: Selector<T, S> | AnyPath | undefined;
  let allOptions: UseStoreOptions<S>;

  if (typeof args[0] === 'function' || isAnyPath(args[0])) {
    selectorRaw = args[0];
    allOptions = args[1] ?? {};
  } else {
    allOptions = args[0] ?? {};
  }

  const selector = useMemo(() => makeSelector<T, S>(selectorRaw), [selectorRaw]);
  const lastEqualsRef = useRef<(newValue: S) => boolean | undefined>(undefined);

  if (store.derivedFrom) {
    return useStore(
      store.derivedFrom.store,
      (value) => {
        for (const selector of store.derivedFrom!.selectors) {
          value = makeSelector(selector)(value);
        }
        return selector(value);
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

  const snapshot = useRef<{ storeValue: T; selectedValue: S }>(undefined);

  const get = useCallback(() => {
    const storeValue = store.get();
    const selectedValue = selector(storeValue);

    const hasChanged =
      !snapshot.current ||
      (storeValue !== snapshot.current.storeValue &&
        !(lastEqualsRef.current?.(selectedValue) ?? false));

    if (hasChanged) {
      snapshot.current = { storeValue, selectedValue };
    }

    return snapshot.current!.selectedValue;
  }, [store, selector]);

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

      const cancel = store.subscribe(_listener, subOptions);
      return () => {
        stopped = true;
        cancel();
      };
    },
    [store, withViewTransition, equals, subOptions],
  );

  let value = useSyncExternalStore<S>(subscribe, get, get);
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
