import { useCallback, useDebugValue, useLayoutEffect, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import type { BaseStore, SubscribeOptions, UpdateFn } from '../../core/types';
import type { Path, Value } from '../../lib/propAccess';
import { get, set } from '../../lib/propAccess';
import { trackingProxy } from '../../lib/trackingProxy';
import { useStoreContext } from './storeContext';

export type UseStoreOptions = Omit<SubscribeOptions, 'runNow'>;

export function useProp<T>(store: BaseStore<T>, options?: UseStoreOptions): [value: T, setValue: UpdateFn<T>];
export function useProp<T extends Record<string, unknown>, P extends Path<T>>(
  store: BaseStore<T>,
  selector: P,
  options?: UseStoreOptions
): [value: Value<T, P>, setValue: UpdateFn<Value<T, P>>];
export function useProp(
  store: BaseStore<unknown>,
  ...[arg0, arg1]: [options?: UseStoreOptions] | [selector: string, options?: UseStoreOptions]
): [any, UpdateFn<any>] {
  store = useStoreContext(store);

  const selector = typeof arg0 === 'string' ? (obj: any) => get(obj, arg0) : (obj: any) => obj;
  const setter = typeof arg0 === 'string' ? (obj: any, value: any) => set(obj, arg0, value) : () => value;
  const options = typeof arg0 === 'string' ? arg1 : arg0;

  const lastEqualsRef = useRef<(newValue: any) => boolean>();

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

  function setValue(value: any) {
    store.set((obj: any) => setter(obj, value));
  }

  useDebugValue(value);
  return [proxiedValue, setValue];
}
