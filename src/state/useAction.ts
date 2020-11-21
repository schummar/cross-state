import hash from 'object-hash';
import { useEffect } from 'react';
import { Action } from './action';
import { useStore } from './useStore';

export function useAction<T, A extends (...args: any[]) => T | T[] | Promise<T> | Promise<T[]>>(
  action: Action<any, T, A>,
  ...args: Parameters<A>
) {
  const key = hash(args);
  const ids = useStore(action.ids, (ids) => ids[key], [key]);
  const items = useStore(
    action.cache,
    (items) => {
      if (ids instanceof Array) {
        const mapped = ids.map((id) => items[id]);
        if (mapped.some((item) => item === undefined)) return undefined;
        return mapped as T[];
      }
      if (ids) return items[ids];
      return undefined;
    },
    [ids]
  );

  useEffect(() => {
    if (!items && !this.isLoading.has(key)) {
      action.load(key, args);
    }
  }, [key, items]);

  return items;
}
