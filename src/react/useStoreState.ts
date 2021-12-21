import eq from 'fast-deep-equal/es6/react';
import { useCallback, useDebugValue } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { StoreSubscribeOptions } from '..';
import { createSelector, SelectorPaths, SelectorValue } from '../helpers/stringSelector';
import { Store } from './store';

export type UseStoreStateOptions = Omit<StoreSubscribeOptions, 'runNow'>;

export function useStoreState<T>(store: Store<T>, options?: UseStoreStateOptions): T;
export function useStoreState<T, S>(store: Store<T>, selector: (state: T) => S, options?: UseStoreStateOptions): S;
export function useStoreState<T, K extends SelectorPaths<T>>(
  store: Store<T>,
  selector: K,
  options?: UseStoreStateOptions
): SelectorValue<T, K>;
export function useStoreState<T, S>(store: Store<T>, ...args: any[]): S {
  let selector: (state: T) => S, options: UseStoreStateOptions;

  if (args[0] instanceof Function) {
    selector = args[0];
    options = args[1] ?? {};
  } else if (typeof args[0] === 'string') {
    selector = createSelector(args[0]);
    options = args[1] ?? {};
  } else {
    selector = (x) => x as any;
    options = args[0] ?? {};
  }

  const subscribe = useCallback(
    (listener: () => void) => {
      return store.subscribe((x) => x, listener, {
        throttle: options.throttle,
        runNow: false,
        compare: (a, b) => a === b,
      });
    },
    [store, options.throttle]
  );

  const value = useSyncExternalStoreWithSelector(
    //
    subscribe,
    () => store.getState(),
    undefined,
    selector,
    options.compare ?? eq
  );

  useDebugValue(value);
  return value;
}
