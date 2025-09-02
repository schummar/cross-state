import type { Cache } from '@core';
import { type UseCacheOptions, type UseCacheValue, useCache } from '@react/useCache';

export const cacheMethods = {
  useCache<T>(this: Cache<T, any>, options?: UseCacheOptions<T>): UseCacheValue<T> {
    return useCache(this, options);
  },
};
