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

/** Subscribe to a resource. This will immediately return cached values, if available, and update for future updates.
 * @param resource the resource to subscribe to.
 * @param options options
 */
export function useResource<Value>(resource: UseResource<Value>, options?: UseResourceOptions): ResourceInfo<Value> {
  const { compare, dormant, throttle, updateOnMount, watchOnly } = options ?? {};

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

  let value = useSyncExternalStoreWithSelector(
    //
    subscribe,
    getSnapshot,
    getSnapshot,
    (x) => x,
    eq
  );

  if (dormant) {
    value = { state: 'empty', isLoading: false };
  }

  useDebugValue(value);
  return value;
}

/** Subscribe to a resource. This will immediately return cached values, if available, and update for future updates. While waiting for data, it throws so that the Component will be suspended. If there is an error, it throws.
 * @param resource the resource to subscribe to.
 * @param options options
 */
export function useReadResource<Value>(resource: UseResource<Value>, options?: UseResourceOptions): Value {
  const info = useResource(resource, options);

  if (info.state === 'error') {
    throw info.error;
  }

  if (info.state === 'empty') {
    throw resource.get();
  }

  useDebugValue(info.value);
  return info.value;
}

export type CombineValues<T> = T extends [UseResource<infer Value>]
  ? [Value]
  : T extends [UseResource<infer Value>, ...infer Rest]
  ? [Value, ...CombineValues<Rest>]
  : T extends readonly UseResource<infer Value>[]
  ? Value[]
  : any[];

/** Combine multiple resources into one that can be fed into useResource or useReadResource. Return value will be an array of the combined resources' values.
 * @param resources resources to be combined
 */
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
