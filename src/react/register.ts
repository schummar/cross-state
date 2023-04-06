import { reactMethods } from './reactMethods';
import { type UseCacheOptions, useCache } from './useCache';
import { Cache, Store } from '@core';

type StoreMethods = typeof reactMethods;
type CacheMethods = typeof cacheMethods;

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends StoreMethods {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Cache<T> extends CacheMethods {}
}

const cacheMethods = {
  useCache<T>(this: Cache<T>, options?: UseCacheOptions) {
    return useCache(this, options);
  },
};

Object.assign(Store.prototype, reactMethods);
Object.assign(Cache.prototype, cacheMethods);
