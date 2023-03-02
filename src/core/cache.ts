import type { Duration, Selector, Use } from './commonTypes';
import { allResources, type ResourceGroup } from './resourceGroup';
import { createStore, Store } from './store';
import type { CacheState, ErrorState, ValueState } from '@lib/cacheState';
import { calcDuration } from '@lib/calcDuration';
import { InstanceCache } from '@lib/instanceCache';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/path';

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
  readonly state = createStore<CacheState<T>>({
    status: 'pending',
    isStale: true,
    isUpdating: false,
  });

  protected stalePromise?: Promise<T>;

  protected timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    getter: CacheFunction<T>,
    public readonly options: CacheOptions<T> = {},
    public readonly derivedFromCache?: {
      cache: Cache<any>;
      selectors: (Selector<any, any> | Path<any>)[];
    },
  ) {
    super(getter, options);
    this.watchPromise();
  }

  get({ update = 'whenStale', backgroundUpdate = false }: CacheGetOptions = {}) {
    const promise = this._value?.v;
    const stalePromise = this.stalePromise;

    if (
      (update === 'whenMissing' && !promise && !stalePromise) ||
      (update === 'whenStale' && !promise) ||
      update === 'force'
    ) {
      this.calculationHelper.execute();

      if ((!promise && !stalePromise) || !backgroundUpdate) {
        return super.get();
      }
    }

    if (!promise || (stalePromise && backgroundUpdate)) {
      return stalePromise!;
    }

    return promise;
  }

  invalidate({ invalidateDependencies = true }: { invalidateDependencies?: boolean } = {}) {
    if (invalidateDependencies) {
      this.calculationHelper.invalidateDependencies();
    }

    const { status, isStale, isUpdating } = this.state.get();
    if (status !== 'pending' && !isStale && !isUpdating) {
      this.stalePromise = this._value?.v;
    }

    this.state.set((state) => ({
      ...state,
      isStale: true,
      isUpdating: false,
    }));

    super.reset();
  }

  clear({ invalidateDependencies = true }: { invalidateDependencies?: boolean } = {}): void {
    if (invalidateDependencies) {
      this.calculationHelper.invalidateDependencies();
    }

    this.state.set({
      status: 'pending',
      isStale: true,
      isUpdating: false,
    });
    delete this.stalePromise;
    super.reset();
  }

  mapValue<S>(selector: Selector<T, S>): Cache<S>;

  mapValue<P extends Path<T>>(selector: P): Cache<Value<T, P>>;

  mapValue<S>(_selector: Selector<T, S> | Path<any>): Cache<S> {
    const selector = makeSelector(_selector);
    const derivedFromCache = {
      cache: this.derivedFromCache ? this.derivedFromCache.cache : this,
      selectors: this.derivedFromCache
        ? [...this.derivedFromCache.selectors, _selector]
        : [_selector],
    };
    const that = this;

    return new Cache(
      async function () {
        const value = await this.use(that);
        return selector(value);
      },
      {},
      derivedFromCache,
    );
  }

  protected watchPromise() {
    this.sub(
      async (promise) => {
        this.state.set((state) => ({
          ...state,
          isUpdating: true,
        }));

        this.setTimers();

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
          delete this.stalePromise;
          this.setTimers();
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
          delete this.stalePromise;
          this.setTimers();
        }
      },
      { passive: true },
    );
  }

  protected setTimers() {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    const state = this.state.get();
    let { invalidateAfter, clearAfter } = this.options;
    const ref = new WeakRef(this);

    if (state.status === 'pending') {
      return;
    }

    if (invalidateAfter instanceof Function) {
      invalidateAfter = invalidateAfter(state);
    }

    if (invalidateAfter) {
      this.timers.add(setTimeout(() => ref?.deref()?.invalidate(), calcDuration(invalidateAfter)));
    }

    if (clearAfter instanceof Function) {
      clearAfter = clearAfter(state);
    }

    if (clearAfter) {
      this.timers.add(setTimeout(() => ref?.deref()?.clear(), calcDuration(clearAfter)));
    }
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
    group.add(resource);
  }

  return Object.assign(get, resource);
}

export const createCache = Object.assign(create, {
  withArgs,
  defaultOptions,
});
