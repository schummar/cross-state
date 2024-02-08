import type { Cache } from '@core';
import type { CacheState } from '@lib/cacheState';
import { makeSelector } from '@lib/makeSelector';
import { useEffect, useMemo } from 'react';
import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';
import { useLoadingBoundary } from '@react/loadingBoundary';

export type UseCacheArray<T> = [
  value: T | undefined,
  error: unknown | undefined,
  isUpdating: boolean,
  isStale: boolean,
];

export type UseCacheValue<T> = UseCacheArray<T> & CacheState<T>;

export interface UseCacheOptions<T> extends UseStoreOptions<UseCacheArray<T> & CacheState<T>> {
  /**
   * If true, will always return undefined as value and no fetch will be triggered.
   * @default false
   */
  disabled?: boolean;

  /**
   * If true, the cache will be invalidated when the component mounts.
   * @default false
   */
  updateOnMount?: boolean;

  /**
   * If true, `useCache` will throw a promise when the cache is pending. This can be used with React Suspense.
   * @see https://react.dev/reference/react/Suspense
   * @default false
   */
  suspense?: boolean;

  /**
   * If true, `useCache` will register its loading state with the nearest `LoadingBoundary`.
   * @default true
   */
  loadingBoundary?: boolean;
}

export function useCache<T>(
  cache: Cache<T>,
  {
    passive,
    disabled,
    updateOnMount,
    withViewTransition,
    suspense,
    loadingBoundary = true,
    ...options
  }: UseCacheOptions<T> = {},
): UseCacheValue<T> {
  if (withViewTransition === true) {
    withViewTransition = (state) => state.value;
  }

  const { rootCache, selector } = useMemo(() => {
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

    return { rootCache, selector };
  }, [cache]);

  useEffect(() => {
    if (updateOnMount) {
      rootCache.invalidate();
    }
  }, []);

  const result = useStore(
    rootCache.state,
    (state) => {
      if (disabled) {
        return Object.assign<UseCacheArray<T>, CacheState<T>>(
          [undefined, undefined, false, false],
          { status: 'pending', isUpdating: false, isStale: false, isConnected: false },
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
          {
            status: 'error',
            error,
            isUpdating: state.isUpdating,
            isStale: state.isStale,
            isConnected: state.isConnected,
          },
        );
      }
    },
    { ...options, withViewTransition, passive: passive || disabled },
  );

  useLoadingBoundary(loadingBoundary && !disabled && result.status === 'pending');

  if (suspense && result.status === 'pending') {
    throw rootCache.get();
  }

  return result;
}
