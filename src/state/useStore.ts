import { useEffect, useState } from 'react';
import { Store } from './store';

export function useStore<T>(store: Store<T>): T;
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S, dependencies?: any[]): S;
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S = (x) => x as any, dependencies: any[] = []) {
  const [state, setState] = useState(selector(store.getState()));

  useEffect(() => {
    return store.subscribe(selector, setState);
  }, [store, ...dependencies]);

  return state;
}
