import eq from 'fast-deep-equal/es6/react';
import { useCallback, useDebugValue, useEffect } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ResourceInstance, ResourceState, ResourceSubscribeOptions } from '..';

export type UseResourceOptions = Omit<ResourceSubscribeOptions, 'runNow'> & {
  /** Invalidate the resource on mount, causing it to update in the background */
  updateOnMount?: boolean;
  /** Don't subscribe resource while this is true */
  dormant?: boolean;
  /** Enable suspense mode */
  suspense?: boolean;
};

export type CombinedResourceState<Resources extends readonly ResourceInstance<any, any>[]> = Omit<ResourceState<any>, 'value'> & {
  values: { [K in keyof Resources]: Resources[K] extends ResourceInstance<any, infer Value> ? Value | undefined : never };
};

export function useCombinedResources<Resources extends readonly ResourceInstance<any, any>[]>(
  ...args: [...resources: Resources] | [...resources: Resources, options?: UseResourceOptions]
): CombinedResourceState<Resources> {
  const resources = args.filter((x) => x instanceof ResourceInstance) as unknown as Resources;
  const options = args.find((x) => !(x instanceof ResourceInstance)) as UseResourceOptions | undefined;
  const { watchOnly, updateOnMount, dormant, throttle, compare = eq, suspense } = options ?? {};

  const resourceIds = resources.map((resource) => resource.id).join(',');

  useEffect(() => {
    if (updateOnMount && !dormant) {
      for (const resource of resources) {
        resource.invalidateCache();
      }
    }
  }, []);

  const subscribe = useCallback(
    (listener: () => void) => {
      const handles = dormant
        ? []
        : resources.map((resource) =>
            resource.subscribe(listener, {
              watchOnly,
              throttle,
              runNow: false,
              compare,
            })
          );

      return () => {
        for (const handle of handles) {
          handle();
        }
      };
    },
    [resourceIds, watchOnly, dormant, throttle]
  );

  const value = useSyncExternalStoreWithSelector(
    //
    subscribe,
    () => {
      const caches = resources.map((resource) => resource.getCache());

      if (suspense) {
        if (resources.some((resource) => !resource.unsafe_getRawCache()?.current)) {
          throw Promise.all(resources.map((resource) => resource.get()));
        }

        const error = caches.find((resource) => resource.error)?.error;
        if (error) {
          throw error;
        }
      }

      return {
        values: caches.map((x) => x?.value) as any,
        error: caches.find((x) => x?.error !== undefined)?.error,
        isLoading: caches.some((x) => x?.isLoading),
        stale: caches.some((x) => x?.stale),
      };
    },
    undefined,
    (x) => x,
    eq
  );

  useDebugValue(value);
  return value;
}

export function useResource<Arg, Value>(resource: ResourceInstance<Arg, Value>, options?: UseResourceOptions): ResourceState<Value> {
  const {
    values: [value],
    ...rest
  } = useCombinedResources(resource, options);

  return {
    value,
    ...rest,
  };
}
