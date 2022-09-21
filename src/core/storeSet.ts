import { Cache, calcDuration } from '../lib';
import { allResources } from './resourceGroup';
import type { HelperFns, Store, StoreOptions } from './store';
import { store } from './store';
import type { Duration } from './commonTypes';

export interface StoreSetOptions<T> extends StoreOptions<T> {
  clearUnusedAfter?: Duration;
}

const defaultOptions: StoreSetOptions<unknown> = {};

function createStoreSet<Value = unknown, Args extends any[] = []>(
  getState: (this: HelperFns, ...args: Args) => Value,
  options: StoreSetOptions<Value> = {}
): (...args: Args) => Store<Value> {
  const cache = new Cache(
    (...args: Args) =>
      store(function () {
        return getState.apply(this, args);
      }, options),
    calcDuration(options.clearUnusedAfter ?? defaultOptions.clearUnusedAfter ?? 0)
  );

  const get = (...args: Args) => {
    return cache.get(...args);
  };

  const invalidate = () => {
    for (const instance of cache.values()) {
      instance.invalidate();
    }
  };

  const clear = () => {
    for (const instance of cache.values()) {
      // instance.clear();
    }
  };

  const resource = { invalidate, clear };
  const groups = Array.isArray(options.resourceGroup) ? options.resourceGroup : options.resourceGroup ? [options.resourceGroup] : [];
  for (const group of groups.concat(allResources)) {
    group.add(resource);
  }

  return Object.assign(get, resource);
}

export const storeSet = Object.assign(createStoreSet, {
  defaultOptions,
});
