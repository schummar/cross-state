import type { Cache } from '@core';
import type { CacheState } from '@lib/cacheState';
import { makeSelector } from '@lib/makeSelector';
import { useLoadingBoundary } from '@react/loadingBoundary';
import { useEffect, useMemo, useRef } from 'react';
import { useStore, type UseStoreOptions } from './useStore';

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
   * @default false
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
    loadingBoundary,
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

  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;

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

      const isStale = updateOnMount && !hasMounted.current ? true : state.isStale;
      try {
        const value = state.status === 'value' ? selector(state.value) : undefined;

        return Object.assign<UseCacheArray<T>, CacheState<T>>(
          [value, state.error, state.isUpdating, isStale],
          { ...state, value, isStale },
        );
      } catch (error) {
        return Object.assign<UseCacheArray<T>, CacheState<T>>(
          [undefined, error, state.isUpdating, isStale],
          {
            status: 'error',
            error,
            isUpdating: state.isUpdating,
            isStale: isStale,
            isConnected: state.isConnected,
          },
        );
      }
    },
    { ...options, withViewTransition, passive: passive || disabled },
  );

  useEffect(
    () => rootCache.subscribe(() => undefined, { passive: passive || disabled }),
    [rootCache, passive || disabled],
  );

  useLoadingBoundary(loadingBoundary && !disabled && result.status === 'pending');

  if (suspense && result.status === 'pending') {
    throw rootCache.get();
  }

  return result;
}
