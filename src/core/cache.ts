import { autobind } from '@lib/autobind';
import type { CacheState, ErrorState, ValueState } from '@lib/cacheState';
import { calcDuration } from '@lib/duration';
import { calculatedValue } from '@lib/calculatedValue';
import type { Constrain } from '@lib/constrain';
import { deepEqual } from '@lib/equals';
import { InstanceCache } from '@lib/instanceCache';
import { makeSelector } from '@lib/makeSelector';
import { type MaybePromise } from '@lib/maybePromise';
import type { AnyPath, Path, Value } from '@lib/path';
import { PromiseWithState } from '@lib/promiseWithState';
import type { Duration, Selector } from './commonTypes';
import { allResources, type ResourceGroup } from './resourceGroup';
import { Store, createStore, type Calculate, type StoreOptions } from './store';

export interface CacheGetOptions {
  /**
   * How to handle the cache when getting the value.
   * - `whenMissing`: Only fetch a new value if there is no cached value.
   * - `whenStale`: Fetch a new value if there is no cached value or if the cached value is stale.
   * - `force`: Always fetch a new value, regardless of the cache state.
   */
  update?: 'whenMissing' | 'whenStale' | 'force';

  /**
   * If set to `true`, the cache will be updated in the background.
   * This means that a stale value will be returned immediately, if available, while the new value is being fetched.
   */
  backgroundUpdate?: boolean;
}

export interface CacheFunction<T, Args extends any[] = []> {
  (...args: Args): Promise<T> | Calculate<Promise<T>>;
}

export interface CacheOptions<T, Args extends any[]> extends StoreOptions<Promise<T>> {
  /**
   * How long to keep the cache entry before it is considered stale.
   * If set to `undefined` or `null`, the cache entry will never be invalidated automatically.
   *
   * @example
   * ```typescript
   * createCache(fetchData, {
   *   invalidateAfter: { seconds: 10 },
   * });
   * ```
   */
  invalidateAfter?: Duration | ((state: ValueState<T> | ErrorState) => Duration | null) | null;

  /**
   * If set, the cache will be invalidated when the window gets focused.
   * This is useful for caches that are used in a browser environment and might become stale when the user switches tabs.
   */
  invalidateOnWindowFocus?: boolean;

  /**
   * If set, the cache will be invalidated when it becomes active - e.g. when it is subscribed to or a component using the cache mounts.
   */
  invalidateOnActivation?: boolean;

  /**
   * If set, the cached value will be cleared when the cache is invalidated.
   * Without this option, the cache will keep the last value as stale until a new value becomes available.
   */
  clearOnInvalidate?: boolean;

  /**
   * If set, cache entries will be cleared after approximately the specified duration.
   * This is useful for long lived pages or applications and helps to prevent memory leaks.
   * The exact time when the entry is cleared is not guaranteed, since it will be cleared during garbage collection.
   */
  clearUnusedAfter?: Duration | null;

  /**
   * Add the cache to the specified resource group(s).
   * This allows you to invalidate or clear multiple caches that belong to the same group.
   * All caches are always added to the `allResources` group.
   */
  resourceGroup?: ResourceGroup | ResourceGroup[];

  /**
   * Function to generate a custom cache key based on the provided arguments.
   * This allows you to control how cache entries are identified and reused.
   * By default, the arguments array is used as the cache key.
   *
   * @example
   * ```typescript
   * // Will use the same instance when provided with `undefined`, `{ num: 0 }`, `{ bool: false }`, etc.
   * createCache((filter?: { num?: number, bool?: boolean }) => fetchData(filter), {
   *   getCacheKey: (filter?) => ({
   *     num: filter?.num ?? 0,
   *     bool: filter?.bool ?? false,
   *   }),
   * });
   * ```
   */
  getCacheKey?: (...args: Args) => unknown;
}

export class Cache<T, Args extends any[] = []> extends Store<Promise<T>> {
  readonly state: Store<CacheState<T>> = createStore<CacheState<T>>({
    status: 'pending',
    isStale: true,
    isUpdating: false,
    isConnected: false,
  });

  protected stalePromise?: Promise<T>;

  protected invalidationTimer?: ReturnType<typeof setTimeout>;

  constructor(
    getter: Calculate<Promise<T>>,
    public readonly args: Args,
    public readonly options: CacheOptions<T, Args> = {},
    public readonly derivedFromCache?: {
      cache: Cache<any, any>;
      selectors: (Selector<any, any> | AnyPath)[];
    },
  ) {
    super(getter, options, undefined);
    autobind(Cache);

    this.watchPromise();
    this.watchFocus();
    this.addEffect(this.onActivation);
  }

  get({ update = 'whenStale', backgroundUpdate = false }: CacheGetOptions = {}): Promise<T> {
    if (!this.calculatedValue?.check()) {
      this.calculatedValue?.stop();
      this.calculatedValue = undefined;
    }

    const promise = this.calculatedValue?.value;
    const stalePromise = this.stalePromise;

    if (
      (update === 'whenMissing' && !promise && !stalePromise) ||
      (update === 'whenStale' && !promise) ||
      update === 'force'
    ) {
      this.calculatedValue = calculatedValue(this, this.notify);
      this.notify();

      if ((!promise && !stalePromise) || !backgroundUpdate) {
        return this.calculatedValue.value;
      }
    }

    if (!promise || (stalePromise && backgroundUpdate)) {
      return stalePromise!;
    }

    return promise;
  }

  updateValue(value: MaybePromise<T> | ((value: T | undefined) => T)): void {
    if (value instanceof Function) {
      value = value(this.state.get().value);
    }
    this.set(PromiseWithState.resolve(value));
  }

  updateError(error: unknown): void {
    this.set(PromiseWithState.reject(error));
  }

  invalidate(recursive?: boolean): void {
    const { clearOnInvalidate } = this.options;

    if (clearOnInvalidate) {
      return this.clear(recursive);
    }

    const { status, isStale, isUpdating } = this.state.get();
    if (status !== 'pending' && !isStale && !isUpdating) {
      this.stalePromise = this.calculatedValue?.value;
    }

    this.state.set((state) => ({
      ...state,
      isStale: true,
      isUpdating: false,
    }));

    super.invalidate(recursive);
  }

  clear(recursive?: boolean): void {
    this.state.set({
      status: 'pending',
      isStale: true,
      isUpdating: false,
      isConnected: false,
    });
    delete this.stalePromise;

    super.invalidate(recursive);
  }

  mapValue<S>(selector: Selector<T, S>): Cache<S, Args>;

  mapValue<const P extends AnyPath>(
    selector: P extends Path<T> ? P : Path<T>,
  ): Cache<Value<T, P>, Args>;

  mapValue(selector: Selector<any, any> | AnyPath) {
    return mapValue(this, selector);
  }

  protected watchPromise(): void {
    this.subscribe(
      async (promise) => {
        if (promise instanceof PromiseWithState && promise.state.status !== 'pending') {
          promise.catch(() => undefined);

          this.state.set((state) => ({
            ...promise.state,
            isStale: false,
            isUpdating: false,
            isConnected: state.isConnected,
          }));

          delete this.stalePromise;
          this.setTimers();
          return;
        }

        this.state.set((state) => ({
          ...state,
          isUpdating: true,
        }));

        this.setTimers();

        try {
          const value = await promise;

          if (promise !== this.calculatedValue?.value) {
            return;
          }

          this.state.set((state) => ({
            status: 'value',
            value,
            isStale: false,
            isUpdating: false,
            isConnected: state.isConnected,
          }));
          delete this.stalePromise;
          this.setTimers();
        } catch (error) {
          if (promise !== this.calculatedValue?.value) {
            return;
          }

          this.state.set((state) => ({
            status: 'error',
            error,
            isStale: false,
            isUpdating: false,
            isConnected: state.isConnected,
          }));
          delete this.stalePromise;
          this.setTimers();
        }
      },
      { passive: true },
    );
  }

  protected setTimers(): void {
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }
    this.invalidationTimer = undefined;

    const state = this.state.get();

    if (state.status === 'pending' || state.isStale) {
      return;
    }

    let { invalidateAfter } = this.options;
    const ref = new WeakRef(this);

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

  protected watchFocus(): void {
    const { invalidateOnWindowFocus } = this.options;

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

      if (!document.hidden && !that.state.get().isConnected) {
        that.invalidate();
      }
    };

    document.addEventListener('visibilitychange', onFocus);
  }

  protected onActivation(): void {
    if (this.options.invalidateOnActivation) {
      this.invalidate();
    }
  }
}

function mapValue<T, S, Args extends any[]>(
  cache: Cache<T, Args>,
  _selector: Selector<T, S> | AnyPath,
): Cache<S, Args> {
  const selector = makeSelector(_selector);
  const derivedFromCache = {
    cache: cache.derivedFromCache ? cache.derivedFromCache.cache : cache,
    selectors: cache.derivedFromCache
      ? [...cache.derivedFromCache.selectors, _selector]
      : [_selector],
  };

  return new Cache<S, Args>(
    async ({ use }) => {
      const value = await use(cache);
      return selector(value);
    },
    cache.args,
    {
      equals: cache.options.equals,
    },
    derivedFromCache,
  );
}

export type CreateCacheResult<
  T,
  Args extends any[],
  TCache extends Cache<T, Args>,
> = [] extends Args ? CacheBundle<T, Args, TCache> & TCache : CacheBundle<T, Args, TCache>;

export interface InvalidationOptions<T, Args extends any[], TCache extends Cache<T, Args>> {
  filter?: (cache: TCache) => boolean;
}

export type CacheBundle<T, Args extends any[], TCache extends Cache<T, Args>> = {
  (...args: Args): TCache;
  mapCache<S>(selector: Selector<T, S>): CreateCacheResult<S, Args, Cache<S, Args>>;
  mapValue<const P>(
    selector: Constrain<P, Path<T>>,
  ): CreateCacheResult<Value<T, P>, Args, Cache<Value<T, P>, Args>>;
  invalidateAll: (options?: InvalidationOptions<T, Args, TCache>) => void;
  clearAll: (options?: InvalidationOptions<T, Args, TCache>) => void;
  getInstances: () => TCache[];
};

function create<T, Args extends any[] = []>(
  cacheFunction: CacheFunction<T, Args>,
  options?: NoInfer<CacheOptions<T, Args>>,
): CreateCacheResult<T, Args, Cache<T, Args>> {
  return internalCreate<T, Args, Cache<T, Args>>(
    (args, options) =>
      new Cache(
        (helpers) => {
          const result = cacheFunction.apply(helpers, args);

          if (result instanceof Function) {
            return result(helpers);
          }

          return result;
        },
        args,
        options,
        undefined,
      ),
    options,
  );
}

export function internalCreate<T, Args extends any[], TCache extends Cache<T, Args>>(
  factory: (args: Args, options: CacheOptions<T, Args>) => TCache,
  options?: CacheOptions<T, Args>,
): CreateCacheResult<T, Args, TCache> {
  options = { ...createCache.defaultOptions, ...options };
  const { clearUnusedAfter, resourceGroup } = options ?? {};

  let baseInstance: CacheBundle<T, Args, TCache> & TCache;

  const instanceCache = new InstanceCache<Args, TCache>(
    (...args) => factory(args, options),
    clearUnusedAfter ? calcDuration(clearUnusedAfter) : undefined,
  );

  function get(...args: Args) {
    const sliceAfter = args.lastIndexOf(undefined);
    if (sliceAfter !== -1) {
      args = args.slice(0, sliceAfter) as Args;
    }

    const cacheKey = options?.getCacheKey ? options.getCacheKey(...args) : args;
    return instanceCache.getWithKey(args, cacheKey);
  }

  const mapCache = (selector: any) => {
    return internalCreate<any, Args, Cache<any, Args>>(
      (args: Args) =>
        new Cache(
          async ({ use }) => {
            const baseValue = await use(get(...args));
            return selector(baseValue);
          },
          args,
          options,
          undefined,
        ),
      options,
    );
  };

  const invalidateAll = ({ filter = () => true }: InvalidationOptions<T, Args, TCache> = {}) => {
    for (const instance of instanceCache.values()) {
      if (filter(instance)) {
        instance.invalidate();
      }
    }
  };

  const clearAll = ({ filter = () => true }: InvalidationOptions<T, Args, TCache> = {}) => {
    for (const instance of instanceCache.values()) {
      if (filter(instance)) {
        instance.clear();
      }
    }
  };

  const getInstances = () => {
    return instanceCache.values();
  };

  baseInstance = new Proxy(
    Object.assign(() => undefined, {
      mapCache,
      invalidateAll,
      clearAll,
      getInstances,
    }),
    {
      apply(_target, _thisArg, argArray) {
        return get(...(argArray as unknown as Args));
      },
      get(target, p, receiver) {
        if (Reflect.has(target, p)) {
          return Reflect.get(target, p, receiver);
        }

        const baseCache = get(...([] as unknown as Args));
        return Reflect.get(baseCache, p, baseCache);
      },
    },
  ) as unknown as CacheBundle<T, Args, TCache> & TCache;

  const groups = Array.isArray(resourceGroup)
    ? resourceGroup
    : resourceGroup
      ? [resourceGroup]
      : [];

  for (const group of groups.concat(allResources)) {
    group.add(baseInstance);
  }

  return baseInstance;
}

export const defaultCacheOptions: CacheOptions<any, any> = {
  invalidateOnWindowFocus: true,
  clearUnusedAfter: { days: 1 },
  retain: { milliseconds: 1 },
  equals: deepEqual,
};

export const createCache: typeof create & { defaultOptions: CacheOptions<any, any> } =
  /* @__PURE__ */ Object.assign(create, {
    defaultOptions: defaultCacheOptions,
  });
