import type { Cache } from '@core';
import type { CacheState } from '@lib/cacheState';
import { makeSelector } from '@lib/makeSelector';
import { useEffect, useMemo } from 'react';
import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';

export type UseCacheArray<T> = [
  value: T | undefined,
  error: unknown | undefined,
  isUpdating: boolean,
  isStale: boolean,
];

export type UseCacheValue<T> = UseCacheArray<T> & CacheState<T>;

export interface UseCacheOptions<T> extends UseStoreOptions<UseCacheArray<T> & CacheState<T>> {
  passive?: boolean;
  disabled?: boolean;
  updateOnMount?: boolean;
}

export function useCache<T>(
  cache: Cache<T>,
  { passive, disabled, updateOnMount, withViewTransition, ...options }: UseCacheOptions<T> = {},
): UseCacheValue<T> {
  if (withViewTransition === true) {
    withViewTransition = (state) => state.value;
  }

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
      if (disabled) {
        return Object.assign<UseCacheArray<T>, CacheState<T>>(
          [undefined, undefined, false, false],
          { status: 'pending', isUpdating: false, isStale: false },
        );
      }

      try {
        const value = state.status === 'value' ? selector(state.value) : undefined;

        return Object.assign<UseCacheArray<T>, CacheState<T>>(
          [value, state.error, state.isUpdating, state.isStale],
          { ...state, value },
        );
      } catch (error) {
        return Object.assign<UseCacheArray<T>, CacheState<T>>(
          [undefined, error, state.isUpdating, state.isStale],
          { status: 'error', error, isUpdating: state.isUpdating, isStale: state.isStale },
        );
      }
    });
  }, [cache]);

  useEffect(() => {
    if (updateOnMount) {
      cache.invalidate();
    }
  }, []);

  useEffect(() => {
    if (passive || disabled) {
      return;
    }

    return cache.subscribe(() => undefined);
  }, [cache, passive, disabled]);

  return useStore(mappedState, { ...options, withViewTransition });
}
