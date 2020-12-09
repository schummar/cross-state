import { useEffect, useState } from 'react';
import { Store } from './store';
import useEqualityRef from './useEqualityRef';

export function useStoreState<T>(store: Store<T>): T;
export function useStoreState<T, S>(store: Store<T>, selector: (state: T) => S, dependencies?: any[]): S;
export function useStoreState<T, S>(store: Store<T>, selector: (state: T) => S = (x) => x as any, deps?: any[]): S {
  const [value, setValue] = useState(() => selector(store.getState()));

  useEffect(() => {
    setValue(selector(store.getState()));
    return store.subscribe(selector, setValue);
  }, [store, useEqualityRef(deps)]);

  return value;
}
