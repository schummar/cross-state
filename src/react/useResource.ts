import { useEffect, useState } from 'react';
import { ResourceInstance, ResourceState } from '../resource';

export type UseResourceOptions = {
  /** Watch value without triggering loading it */
  watchOnly?: boolean;
  /**  */
  updateOnMount?: boolean;
  /** */
  dormant?: boolean;
  /** */
  throttle?: number;
};

export type CombinedResourceState<Resources extends readonly ResourceInstance<any, any>[]> = Omit<ResourceState<any>, 'value'> & {
  values: { [K in keyof Resources]: Resources[K] extends ResourceInstance<any, infer Value> ? Value | undefined : never };
};

const ignore = () => {
  //ignore
};

export function useCombinedResources<Resources extends readonly ResourceInstance<any, any>[]>(
  ...args: [...resources: Resources] | [...resources: Resources, options?: UseResourceOptions]
): CombinedResourceState<Resources> {
  const resources = args.filter((x) => x instanceof ResourceInstance) as unknown as Resources;
  const options = args.find((x) => !(x instanceof ResourceInstance)) as UseResourceOptions | undefined;
  const { watchOnly, updateOnMount, dormant, throttle } = options ?? {};

  // This id is updated when the resource notifies about changes, in order to trigger another render
  const [, setId] = useState({});

  useEffect(() => {
    if (updateOnMount && !dormant) {
      for (const resource of resources) {
        resource.invalidateCache();
      }
    }
  }, []);

  useEffect(() => {
    if (dormant) {
      return;
    }

    const handles = resources.map((resource) =>
      resource.subscribe(
        () => {
          setId({});
          if (!watchOnly) resource.get().catch(ignore);
        },
        { throttle }
      )
    );

    return () => {
      for (const handle of handles) {
        handle();
      }
    };
  }, [
    //
    resources.map((resource) => resource.id).join(','),
    watchOnly,
    dormant,
    throttle,
  ]);

  const state = resources.map((resource) => resource.getCache());
  return {
    values: state.map((x) => x?.value) as any,
    error: state.find((x) => x?.error !== undefined)?.error,
    isLoading: state.some((x) => x?.isLoading),
    stale: state.some((x) => x?.stale),
  };
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
