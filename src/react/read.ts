import type { Cache } from '@core';
import { useCache, type UseCacheOptions } from './useCache';

export function read<T>(cache: Cache<T>, options?: UseCacheOptions<T>): T {
  const { status, value, error } = useCache(cache, options);

  if (status === 'value') {
    return value;
  }

  if (status === 'error') {
    throw error;
  }

  throw cache.state.once((state) => state.status !== 'pending');
}
