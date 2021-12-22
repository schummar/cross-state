import eq from 'fast-deep-equal/es6/react';
import { useCallback, useDebugValue, useEffect } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ResourceInfo, ResourceInstance, ResourceSubscribeOptions } from '..';
import { hash } from '../helpers/hash';

export type UseResource<Value> = Pick<ResourceInstance<unknown, Value>, 'id' | 'invalidateCache' | 'subscribe' | 'getCache' | 'get'>;
export type UseResourceOptions = Omit<ResourceSubscribeOptions, 'runNow'> & {
  /** Invalidate the resource on mount, causing it to update in the background */
  updateOnMount?: boolean;
  /** Don't subscribe resource while this is true */
  dormant?: boolean;
};

export function useResource<Value>(
  resource: UseResource<Value>,
  { compare, dormant, throttle, updateOnMount, watchOnly }: UseResourceOptions = {}
): ResourceInfo<Value> {
  useEffect(() => {
    if (updateOnMount && !dormant) {
      resource.invalidateCache();
    }
  }, []);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (dormant)
        return () => {
          // nothing to do
        };

      return resource.subscribe(listener, {
        watchOnly,
        throttle,
        runNow: false,
        compare,
      });
    },
    [resource.id, watchOnly, dormant, throttle]
  );

  const getSnapshot = () => {
    return resource.getCache();
  };

  const value = useSyncExternalStoreWithSelector(
    //
    subscribe,
    getSnapshot,
    getSnapshot,
    (x) => x,
    eq
  );

  useDebugValue(value);
  return value;
}

export type CombineValues<T> = T extends [UseResource<infer Value>]
  ? [Value]
  : T extends [UseResource<infer Value>, ...infer Rest]
  ? [Value, ...CombineValues<Rest>]
  : T extends readonly UseResource<infer Value>[]
  ? Value[]
  : any[];

export function combineResources<Resources extends readonly UseResource<any>[]>(
  ...resources: Resources
): UseResource<CombineValues<Resources>> {
  return {
    id: hash(resources.map((resource) => resource.id)),

    invalidateCache() {
      for (const resource of resources) {
        resource.invalidateCache();
      }
    },

    subscribe(listener, options) {
      const handles = resources.map((resource) => resource.subscribe(listener, options));

      return () => {
        for (const handle of handles) {
          handle();
        }
      };
    },

    getCache() {
      const caches = resources.map((resource) => resource.getCache());
      const isStale = caches.some((cache) => cache.isStale);
      const isLoading = caches.some((cache) => cache.isLoading);

      if (caches.some((resource) => resource.state === 'error')) {
        const error = caches.find((cache) => cache.error !== undefined)?.error;
        return { state: 'error', error, isStale, isLoading };
      }

      if (caches.every((resource) => resource.state === 'value')) {
        const value = caches.map((cache) => cache.value) as CombineValues<Resources>;
        return { state: 'value', value, isStale, isLoading };
      }

      return { state: 'empty', isLoading };
    },

    get() {
      return Promise.all(resources.map((resource) => resource.get())) as Promise<CombineValues<Resources>>;
    },
  };
}
