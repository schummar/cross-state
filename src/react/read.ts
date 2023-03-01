import { useCache } from './useCache';
import type { UseStoreOptions } from './useStore';
import type { Cache } from '@core';

export function read<T>(cache: Cache<T>, options?: UseStoreOptions): T {
  const { status, value, error } = useCache(cache, options);

  if (status === 'value') {
    return value;
  }

  if (status === 'error') {
    throw error;
  }

  throw cache.state.once((state) => state.status !== 'pending');
}
