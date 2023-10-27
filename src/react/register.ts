import { Cache, Scope, Store } from '@core';
import { reactMethods } from './reactMethods';
import { ScopeProvider, useScope, useScopeProp, useScopeStore, type ScopeProps } from './scope';
import { useCache, type UseCacheOptions } from './useCache';
import { type UseStoreOptions } from './useStore';

type StoreMethods = typeof reactMethods;
type CacheMethods = typeof cacheMethods;
type ScopeMethods = typeof scopeMethods;

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends StoreMethods {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Cache<T> extends CacheMethods {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Scope<T> extends ScopeMethods {}
}

const cacheMethods = {
  useCache<T>(this: Cache<T>, options?: UseCacheOptions<T>) {
    return useCache(this, options);
  },
};

const scopeMethods = {
  useScope<T>(this: Scope<T>) {
    return useScope(this);
  },

  useStore<T>(this: Scope<T>, options?: UseStoreOptions<T>) {
    return useScopeStore(this, options);
  },

  useProp<T>(this: Scope<T>, options?: UseStoreOptions<T>) {
    return useScopeProp(this, options);
  },

  Provider<T>(this: Scope<T>, props: Omit<ScopeProps<T>, 'scope'>) {
    return ScopeProvider({ ...props, scope: this });
  },
};

Object.assign(Store.prototype, reactMethods);
Object.assign(Cache.prototype, cacheMethods);
Object.assign(Scope.prototype, scopeMethods);
