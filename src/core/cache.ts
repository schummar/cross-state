import type { Duration, Selector, Update, Use } from './commonTypes';
import type { ResourceGroup } from './resourceGroup';
import { allResources } from './resourceGroup';
import type { StoreOptions } from './store';
import { createStore, Store } from './store';
import type { CacheState, ErrorState, ValueState } from '@lib/cacheState';
import { calcDuration } from '@lib/calcDuration';
import { InstanceCache } from '@lib/instanceCache';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/path';
import { trackPromise } from '@lib/trackedPromise';

export interface CacheGetOptions {
  update?: 'whenMissing' | 'whenStale' | 'force';
  backgroundUpdate?: boolean;
}

export interface CacheFunction<T, Args extends any[] = []> {
  (this: { use: Use }, ...args: Args): Promise<T>;
}

export interface CacheOptions<T> {
  invalidateAfter?: Duration | ((state: ValueState<T> | ErrorState) => Duration | undefined);
  clearAfter?: Duration | ((state: ValueState<T> | ErrorState) => Duration | undefined);
  resourceGroup?: ResourceGroup | ResourceGroup[];
  retain?: number;
  clearUnusedAfter?: Duration;
}

export class Cache<T> extends Store<Promise<T>> {
  state = createStore<CacheState<T>>({
    status: 'pending',
    isStale: true,
    isUpdating: false,
  });

  constructor(
    getter: CacheFunction<T>,
    options?: StoreOptions,
    derivedFrom?: { store: Store<any>; selectors: (Selector<any, any> | Path<any>)[] },
  ) {
    super(getter, options, derivedFrom);

    this.sub(
      async (promise) => {
        this.state.set((state) => ({
          ...state,
          isUpdating: true,
        }));

        try {
          const value = await promise;

          if (promise !== this._value?.v) {
            return;
          }

          this.state.set({
            status: 'value',
            value,
            isStale: false,
            isUpdating: false,
          });
        } catch (error) {
          if (promise !== this._value?.v) {
            return;
          }

          this.state.set({
            status: 'error',
            error,
            isStale: false,
            isUpdating: false,
          });
        }
      },
      { passive: true },
    );
  }

  get({ update = 'whenStale', backgroundUpdate = false }: CacheGetOptions = {}) {
    const promise = this._value?.v;
    const { status, value, error } = this.state.get();

    if (
      (update === 'whenMissing' && !promise && status === 'pending') ||
      (update === 'whenStale' && !promise) ||
      update === 'force'
    ) {
      this.invalidate();
      const newValue = super.get();

      if ((!promise && status === 'pending') || !backgroundUpdate) {
        return newValue;
      }
    }

    if (!promise || (status !== 'pending' && backgroundUpdate)) {
      return status === 'value' ? Promise.resolve(value) : Promise.reject(error);
    }

    return promise;
  }

  update(update: Update<Promise<T>>): void {
    if (update instanceof Function) {
      const updateFunction = update;

      return super.set((oldValue) => {
        const newValue = updateFunction(oldValue);
        return trackPromise(newValue);
      });
    }

    super.set(trackPromise(update));
  }

  invalidate() {
    this.state.set((state) => ({
      ...state,
      isStale: true,
      isUpdating: false,
    }));

    super.reset();
  }

  clear(): void {
    super.reset();
  }

  mapValue<S>(selector: Selector<T, S>): Cache<S>;

  mapValue<P extends Path<T>>(selector: P): Cache<Value<T, P>>;

  mapValue<S>(_selector: Selector<T, S> | Path<any>): Cache<S> {
    const selector = makeSelector(_selector);
    const that = this;

    return new Cache(async function () {
      const value = await this.use(that);
      return selector(value);
    });
  }
}

const defaultOptions: CacheOptions<unknown> = {};

function create<T>(cacheFunction: CacheFunction<T>, options?: CacheOptions<T>): Cache<T> {
  return withArgs(cacheFunction, options)();
}

function withArgs<T, Args extends any[]>(
  cacheFunction: CacheFunction<T, Args>,
  options?: CacheOptions<T>,
): {
  (...args: Args): Cache<T>;
  invalidate: () => void;
  clear: () => void;
} {
  const { clearUnusedAfter = defaultOptions.clearUnusedAfter ?? 0, resourceGroup } = options ?? {};

  const cache = new InstanceCache(
    (...args: Args) =>
      new Cache(function () {
        return cacheFunction.apply(this, args);
      }, options),
    calcDuration(clearUnusedAfter),
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
      instance.clear();
    }
  };

  const resource = { invalidate, clear };
  const groups = Array.isArray(resourceGroup)
    ? resourceGroup
    : resourceGroup
    ? [resourceGroup]
    : [];
  for (const group of groups.concat(allResources)) {
    group.resources.add(resource);
  }

  return Object.assign(get, resource);
}

export const createCache = Object.assign(create, {
  withArgs,
  defaultOptions,
});
