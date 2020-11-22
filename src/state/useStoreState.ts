import { useRef, useState } from 'react';
import { Store } from './store';
import useEarlyEffect from './useEarlyEffect';
import useEqualityRef from './useEqualityRef';

export function useStoreState<T>(store: Store<T>): T;
export function useStoreState<T, S>(store: Store<T>, selector: (state: T) => S, dependencies?: any[]): S;
export function useStoreState<T, S>(store: Store<T>, selector: (state: T) => S = (x) => x as any, deps?: any[]): S {
  const value = useRef<S>();
  const [, setVersion] = useState(0);

  useEarlyEffect(() => {
    value.current = selector(store.getState());
    return store.subscribe(selector, (newValue) => {
      value.current = newValue;
      setVersion((version) => version + 1);
    });
  }, [store, useEqualityRef(deps)]);

  return value.current as S;
}
