import eq from 'fast-deep-equal/es6/react';
import { useCallback, useDebugValue, useEffect } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ResourceInstance, ResourceState, ResourceSubscribeOptions } from '..';

export type UseResourceOptions = Omit<ResourceSubscribeOptions, 'runNow'> & {
  /** Invalidate the resource on mount, causing it to update in the background */
  updateOnMount?: boolean;
  /** Don't subscribe resource while this is true */
  dormant?: boolean;
};

export type CombinedResourceState<Resources extends readonly ResourceInstance<any, any>[]> = Omit<ResourceState<any>, 'value'> & {
  values: { [K in keyof Resources]: Resources[K] extends ResourceInstance<any, infer Value> ? Value | undefined : never };
};

export function useCombinedResources<Resources extends readonly ResourceInstance<any, any>[]>(
  ...args: [...resources: Resources] | [...resources: Resources, options?: UseResourceOptions]
): CombinedResourceState<Resources> {
  const resources = args.filter((x) => x instanceof ResourceInstance) as unknown as Resources;
  const options = args.find((x) => !(x instanceof ResourceInstance)) as UseResourceOptions | undefined;
  const { watchOnly, updateOnMount, dormant, throttle, compare = eq } = options ?? {};

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
    [
      //
      resources.map((resource) => resource.id).join(','),
      watchOnly,
      dormant,
      throttle,
    ]
  );

  const value = useSyncExternalStoreWithSelector(
    //
    subscribe,
    () => {
      const state = resources.map((resource) => resource.getCache());
      return {
        values: state.map((x) => x?.value) as any,
        error: state.find((x) => x?.error !== undefined)?.error,
        isLoading: state.some((x) => x?.isLoading),
        stale: state.some((x) => x?.stale),
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
