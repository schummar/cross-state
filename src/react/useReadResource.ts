import { useDebugValue } from 'react';
import { UseResource, useResource, UseResourceOptions } from '.';

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
