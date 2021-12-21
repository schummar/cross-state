import { useCombinedResources, UseResourceOptions } from '.';
import { ResourceInstance } from '..';

export type ReadCombinedResourceState<T> = T extends [ResourceInstance<any, infer Value>, ...infer Rest]
  ? [Value, ...ReadCombinedResourceState<Rest>]
  : T extends readonly ResourceInstance<any, infer Value>[]
  ? Value[]
  : T extends readonly ResourceInstance<any, any>[]
  ? any[]
  : [];

export function useReadCombinedResources<Resources extends readonly ResourceInstance<any, any>[]>(
  ...args: [...resources: Resources] | [...resources: Resources, options?: UseResourceOptions]
): ReadCombinedResourceState<Resources> {
  const resources = args.filter((x) => x instanceof ResourceInstance) as unknown as Resources;

  const { values, error, isLoading } = useCombinedResources(...args);

  if (isLoading) throw Promise.all(resources.map((resource) => resource.get()));
  if (error) throw error;
  return values as any;
}

export function useReadResource<Arg, Value>(resource: ResourceInstance<Arg, Value>, options?: UseResourceOptions): Value {
  const [value] = useReadCombinedResources(resource, options);
  return value;
}
