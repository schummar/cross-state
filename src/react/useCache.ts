import { useEffect, useMemo } from 'react';
import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';
import type { Cache } from '@core';
import type { CacheState } from '@lib/cacheState';
import { makeSelector } from '@lib/makeSelector';

export type UseCacheArray<T> = [
  value: T | undefined,
  error: unknown | undefined,
  isUpdating: boolean,
  isStale: boolean,
];

export type UseCacheValue<T> = UseCacheArray<T> & CacheState<T>;

export interface UseCacheOptions extends UseStoreOptions {
  passive?: boolean;
}

export function useCache<T>(
  cache: Cache<T>,
  { passive, ...options }: UseCacheOptions = {},
): UseCacheValue<T> {
  const mappedState = useMemo(() => {
    const rootCache: Cache<any> = cache.derivedFromCache?.cache ?? cache;
    let selector = (x: any) => x;

    if (cache.derivedFromCache) {
      selector = (value: any) => {
        for (const s of cache.derivedFromCache!.selectors) {
          value = makeSelector(s)(value);
        }
        return value;
      };
    }

    return rootCache.state.map((state) => {
      const value = state.status === 'value' ? selector(state.value) : undefined;

      return Object.assign<UseCacheArray<T>, CacheState<T>>(
        [value, state.error, state.isUpdating, state.isStale],
        { ...state, value },
      );
    });
  }, [cache]);

  useEffect(() => (!passive ? cache.subscribe(() => undefined) : undefined), [cache, passive]);

  return useStore(mappedState, options);
}
