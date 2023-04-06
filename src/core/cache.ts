import type { Duration, Selector, Use } from './commonTypes';
import { allResources, type ResourceGroup } from './resourceGroup';
import { Store, createStore } from './store';
import type { CacheState, ErrorState, ValueState } from '@lib/cacheState';
import { calcDuration } from '@lib/calcDuration';
import { InstanceCache } from '@lib/instanceCache';
import { makeSelector } from '@lib/makeSelector';
import { type MaybePromise } from '@lib/maybePromise';
import type { Path, Value } from '@lib/path';
import { PromiseWithState } from '@lib/promiseWithState';

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
    _call?: (...args: any[]) => any,
  ) {
    super(getter, options, undefined, _call);
    this.invalidate = this.invalidate.bind(this);
    this.clear = this.clear.bind(this);
    this.mapValue = this.mapValue.bind(this);

    this.calculationHelper.options.onInvalidate = () => this.invalidate();
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

  updateValue(value: MaybePromise<T>) {
    this.set(PromiseWithState.resolve(value));
  }

  updateError(error: unknown) {
    this.set(PromiseWithState.reject(error));
  }

  invalidate({ invalidateDependencies = true }: { invalidateDependencies?: boolean } = {}) {
    const { clearOnInvalidate = createCache.defaultOptions.clearOnInvalidate } = this.options;

    if (clearOnInvalidate) {
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

    this.calculationHelper.stop();
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

    this.calculationHelper.stop();
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
    this.subscribe(
      async (promise) => {
        if (promise instanceof PromiseWithState) {
          this.state.set({
            ...promise.state,
            isStale: false,
            isUpdating: false,
          });

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
    let { invalidateAfter = createCache.defaultOptions.invalidateAfter } = this.options;
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
    const { invalidateOnWindowFocus = createCache.defaultOptions.invalidateOnWindowFocus } =
      this.options;

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

type CreateReturnType<T, Args extends any[]> = {
  (...args: Args): Cache<T>;
  invalidateAll: () => void;
  clearAll: () => void;
} & ([] extends Args ? Cache<T> : {});

function create<T, Args extends any[]>(
  cacheFunction: CacheFunction<T, Args>,
  options?: CacheOptions<T>,
): CreateReturnType<T, Args> {
  const { clearUnusedAfter = createCache.defaultOptions.clearUnusedAfter, resourceGroup } =
    options ?? {};

  let baseInstance: CreateReturnType<T, Args> & Cache<T>;

  const instanceCache = new InstanceCache<Args, Cache<T>>(
    (...args: Args): Cache<T> => {
      if (args.length === 0 && baseInstance) {
        return baseInstance;
      }

      return new Cache(function () {
        return cacheFunction.apply(this, args);
      }, options);
    },
    clearUnusedAfter ? calcDuration(clearUnusedAfter) : undefined,
  );

  const get = (...args: Args) => {
    return instanceCache.get(...args);
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

  const groups = Array.isArray(resourceGroup)
    ? resourceGroup
    : resourceGroup
    ? [resourceGroup]
    : [];
  for (const group of groups.concat(allResources)) {
    group.add({ invalidate: invalidateAll, clear: clearAll });
  }

  baseInstance = Object.assign(
    new Cache(
      function () {
        return cacheFunction.apply(this);
      },
      options,
      undefined,
      get,
    ),
    {
      invalidateAll,
      clearAll,
    },
  ) as CreateReturnType<T, Args> & Cache<T>;

  get(...([] as any));

  return baseInstance;
}

export const createCache = /* @__PURE__ */ Object.assign(create, {
  defaultOptions: {
    invalidateOnWindowFocus: true,
    invalidateOnActivation: true,
    clearUnusedAfter: { days: 1 },
  } as CacheOptions<unknown>,
});
