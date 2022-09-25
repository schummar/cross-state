import { Cache, calcDuration } from '../lib';
import { allResources } from './resourceGroup';
import type { ProviderHelpers, ProviderHelpersWithUpdate, Store, StoreOptions } from './store';
import { store } from './store';
import type { Duration } from './commonTypes';
import { Cancel } from '..';

export interface StoreSetOptions<T> extends StoreOptions<T> {
  clearUnusedAfter?: Duration;
}

const defaultOptions: StoreSetOptions<unknown> = {};

function createStoreSet<T, Args extends any[] = []>(
  connect: (this: ProviderHelpersWithUpdate<T>, ...args: Args) => Cancel,
  options?: StoreSetOptions<T>
): (...args: Args) => Store<T, true>;

function createStoreSet<T, Args extends any[] = []>(
  getState: (this: ProviderHelpersWithUpdate<unknown>, ...args: Args) => T,
  options?: StoreSetOptions<T>
): (...args: Args) => Store<T, true>;

function createStoreSet<T, Args extends any[]>(
  getState: (this: ProviderHelpers | ProviderHelpersWithUpdate<T>, ...args: Args) => T | Cancel,
  options: StoreSetOptions<T> = {}
): (...args: Args) => Store<T, true> {
  const cache = new Cache(
    (...args: Args) =>
      store((x) => {
        return getState.apply(x, args);
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
