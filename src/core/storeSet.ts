import type { Cancel } from '..';
import { Cache, calcDuration } from '../lib';
import type { Duration } from './commonTypes';
import { allResources } from './resourceGroup';
import type { ProviderHelpers, Store, StoreOptions, StoreType } from './store';
import { store } from './store';

export interface StoreSetOptions<T, Type extends StoreType> extends StoreOptions<T, Type> {
  clearUnusedAfter?: Duration;
}

const defaultOptions: StoreSetOptions<unknown, StoreType> = {};

function createStoreSet<T, Args extends any[] = []>(
  subscribe: (this: ProviderHelpers<T>, ...args: Args) => Cancel,
  options?: StoreSetOptions<T, 'subscription'>
): (...args: Args) => Store<T, 'subscription'>;

function createStoreSet<T, Args extends any[] = []>(
  getState: (this: ProviderHelpers<unknown>, ...args: Args) => T,
  options?: StoreSetOptions<T, 'dynamic'>
): (...args: Args) => Store<T, 'dynamic'>;

function createStoreSet<T, Args extends any[]>(
  getState: (this: any, ...args: Args) => any,
  options: StoreSetOptions<T, 'dynamic' | 'subscription'> = {}
): (...args: Args) => Store<T, 'dynamic' | 'subscription'> {
  const cache = new Cache(
    (...args: Args) =>
      (store as any)((x: any) => {
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
