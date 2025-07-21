import { autobind } from '@lib/autobind';
import type { CacheState, ErrorState, ValueState } from '@lib/cacheState';
import { calcDuration } from '@lib/calcDuration';
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
  update?: 'whenMissing' | 'whenStale' | 'force';
  backgroundUpdate?: boolean;
}

export interface CacheFunction<T, Args extends any[] = []> {
  (...args: Args): Promise<T> | Calculate<Promise<T>>;
}

export interface CacheOptions<T> extends StoreOptions<Promise<T>> {
  invalidateAfter?: Duration | ((state: ValueState<T> | ErrorState) => Duration | null) | null;
  invalidateOnWindowFocus?: boolean;
  invalidateOnActivation?: boolean;
  clearOnInvalidate?: boolean;
  clearUnusedAfter?: Duration | null;
  resourceGroup?: ResourceGroup | ResourceGroup[];
}

export class Cache<T> extends Store<Promise<T>> {
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
    public readonly options: CacheOptions<T> = {},
    public readonly derivedFromCache?: {
      cache: Cache<any>;
      selectors: (Selector<any, any> | AnyPath)[];
    },
    _call?: (...args: any[]) => any,
  ) {
    super(getter, options, undefined, _call);
    autobind(Cache);

    this.watchPromise();
    this.watchFocus();
  }

  get({ update = 'whenStale', backgroundUpdate = false }: CacheGetOptions = {}): Promise<T> {
    this.calculatedValue?.check();
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

  mapValue<S>(selector: Selector<T, S>): Cache<S>;

  mapValue<const P extends AnyPath>(selector: P extends Path<T> ? P : Path<T>): Cache<Value<T, P>>;

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
    let { invalidateAfter } = this.options;
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
}

function mapValue<T, S>(cache: Cache<T>, _selector: Selector<T, S> | AnyPath, get?: any): Cache<S> {
  const selector = makeSelector(_selector);
  const derivedFromCache = {
    cache: cache.derivedFromCache ? cache.derivedFromCache.cache : cache,
    selectors: cache.derivedFromCache
      ? [...cache.derivedFromCache.selectors, _selector]
      : [_selector],
  };

  return new Cache(
    async ({ use }) => {
      const value = await use(cache);
      return selector(value);
    },
    {
      equals: cache.options.equals,
    },
    derivedFromCache,
    get,
  );
}

export type CreateCacheResult<T, Args extends any[]> = [] extends Args
  ? CacheBundle<T, Args> & Cache<T>
  : CacheBundle<T, Args>;

export type CacheBundle<T, Args extends any[]> = {
  (...args: Args): Cache<T>;
  mapCache<S>(selector: Selector<T, S>): CreateCacheResult<S, Args>;
  mapValue<const P>(selector: Constrain<P, Path<T>>): CreateCacheResult<Value<T, P>, Args>;
  invalidateAll: () => void;
  clearAll: () => void;
};

function create<T, Args extends any[] = []>(
  cacheFunction: CacheFunction<T, Args>,
  options?: CacheOptions<T>,
): CreateCacheResult<T, Args> {
  return internalCreate<T, Args>(cacheFunction, options);
}

function internalCreate<T, Args extends any[] = []>(
  source:
    | CacheFunction<T, Args>
    | [cache: CacheBundle<any, Args>, selector: Selector<any, T> | AnyPath],
  options?: CacheOptions<T>,
): CreateCacheResult<T, Args> {
  options = { ...createCache.defaultOptions, ...options };
  const { clearUnusedAfter, resourceGroup } = options ?? {};

  let baseInstance: CacheBundle<T, Args> & Cache<T>;

  const instanceCache = new InstanceCache<Args, Cache<T>>(
    (...args: Args): Cache<T> => {
      if (args.length === 0 && baseInstance) {
        return baseInstance;
      }

      if (Array.isArray(source)) {
        const [cache, selector] = source;
        return mapValue(cache(...args), selector, get);
      }

      return new Cache(
        (helpers) => {
          const result = source.apply(helpers, args);

          if (result instanceof Function) {
            return result(helpers);
          }

          return result;
        },
        options,
        undefined,
        args.length === 0 ? get : undefined,
      );
    },
    clearUnusedAfter ? calcDuration(clearUnusedAfter) : undefined,
  );

  function get(...args: Args) {
    const sliceAfter = args.lastIndexOf(undefined);
    if (sliceAfter !== -1) {
      args = args.slice(0, sliceAfter) as Args;
    }

    return instanceCache.get(...args);
  }

  const mapCache = (selector: any) => {
    return internalCreate([baseInstance, selector]);
  };

  const invalidateAll = () => {
    for (const instance of instanceCache.values()) {
      instance.invalidate();
    }
  };

  const clearAll = () => {
    for (const instance of instanceCache.values()) {
      instance.clear();
    }
  };

  baseInstance = Object.assign(get(...([] as unknown as Args)), {
    mapCache,
    invalidateAll,
    clearAll,
  }) as CacheBundle<T, Args> & Cache<T>;

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

export const createCache: typeof create & { defaultOptions: CacheOptions<any> } =
  /* @__PURE__ */ Object.assign(create, {
    defaultOptions: {
      invalidateOnWindowFocus: true,
      invalidateOnActivation: true,
      clearUnusedAfter: { days: 1 },
      retain: { milliseconds: 1 },
      equals: deepEqual,
    } as CacheOptions<any>,
  });
