import { useMemo } from 'react';
import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';
import type { CacheState } from '@lib/cacheState';
import type { Cache } from '@core';

export type UseCacheArray<T> = [
  value: T | undefined,
  error: unknown | undefined,
  isUpdating: boolean,
  isStale: boolean,
];

export type UseCacheValue<T> = UseCacheArray<T> & CacheState<T>;

export function useCache<T>(cache: Cache<T>, options?: UseStoreOptions): UseCacheValue<T> {
  const mappedStore = useMemo(
    () =>
      cache.state.map((state) =>
        Object.assign<UseCacheArray<T>, CacheState<T>>(
          [state.value, state.error, state.isUpdating, state.isStale],
          state,
        ),
      ),
    [cache],
  );

  return useStore(mappedStore, options);
}
