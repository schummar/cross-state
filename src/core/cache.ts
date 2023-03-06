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
  invalidateAfter?: Duration | ((state: ValueState<T> | ErrorState) => Duration | null) | null;
  invalidateOnWindowFocus?: boolean;
  invalidateOnActivation?: boolean;
  clearOnInvalidate?: boolean;
  clearUnusedAfter?: Duration | null;
  resourceGroup?: ResourceGroup | ResourceGroup[];
  retain?: number;
}

export class Cache<T> extends Store<Promise<T>> {
  readonly state = createStore<CacheState<T>>({
    status: 'pending',
    isStale: true,
    isUpdating: false,
  });

  protected stalePromise?: Promise<T>;

  protected invalidationTimer?: ReturnType<typeof setTimeout>;

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
    this.watchFocus();
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
    const { clearOnInvalidate: clearOnInvalidation = defaultOptions.clearOnInvalidate } =
      this.options;

    if (clearOnInvalidation) {
      return this.clear({ invalidateDependencies });
    }

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
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }
    this.invalidationTimer = undefined;

    const state = this.state.get();
    let { invalidateAfter = defaultOptions.invalidateAfter } = this.options;
    const ref = new WeakRef(this);

    if (state.status === 'pending') {
      return;
    }

    if (invalidateAfter instanceof Function) {
      invalidateAfter = invalidateAfter(state);
    }

    if (invalidateAfter !== null && invalidateAfter !== undefined) {
      this.invalidationTimer = setTimeout(
        () => ref?.deref()?.invalidate(),
        calcDuration(invalidateAfter),
      );
    }
  }

  protected watchFocus() {
    const { invalidateOnWindowFocus = defaultOptions.invalidateOnWindowFocus } = this.options;

    if (
      !invalidateOnWindowFocus ||
      typeof document === 'undefined' ||
      typeof document.addEventListener === 'undefined'
    ) {
      return;
    }

    const ref = new WeakRef(this);

    const onFocus = () => {
      const that = ref?.deref();
      if (!that) {
        document.removeEventListener('visibilitychange', onFocus);
        return;
      }

      if (!document.hidden) {
        that.invalidate();
      }
    };

    document.addEventListener('visibilitychange', onFocus);
  }
}

const defaultOptions: CacheOptions<unknown> = {
  invalidateOnWindowFocus: true,
  invalidateOnActivation: true,
  clearUnusedAfter: { days: 1 },
};

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
  const { clearUnusedAfter = defaultOptions.clearUnusedAfter, resourceGroup } = options ?? {};

  const cache = new InstanceCache(
    (...args: Args) =>
      new Cache(function () {
        return cacheFunction.apply(this, args);
      }, options),
    clearUnusedAfter ? calcDuration(clearUnusedAfter) : undefined,
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
