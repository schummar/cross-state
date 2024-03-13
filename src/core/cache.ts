import { autobind } from '@lib/autobind';
import type { CacheState, ErrorState, ValueState } from '@lib/cacheState';
import { calcDuration } from '@lib/calcDuration';
import { calculatedValue } from '@lib/calculatedValue';
import { InstanceCache } from '@lib/instanceCache';
import { makeSelector } from '@lib/makeSelector';
import { type MaybePromise } from '@lib/maybePromise';
import type { Path, Value } from '@lib/path';
import { PromiseWithState } from '@lib/promiseWithState';
import type { Duration, Selector } from './commonTypes';
import { allResources, type ResourceGroup } from './resourceGroup';
import { Store, createStore, type Calculate, type StoreOptions } from './store';
import { deepEqual } from '@lib/equals';

export interface CacheGetOptions {
  update?: 'whenMissing' | 'whenStale' | 'force';
  backgroundUpdate?: boolean;
}

export interface CacheFunction<T, Args extends any[] = []> {
  (...args: Args): Promise<T> | Calculate<Promise<T>>;
}

export interface CacheOptions<T> extends StoreOptions {
  invalidateAfter?: Duration | ((state: ValueState<T> | ErrorState) => Duration | null) | null;
  invalidateOnWindowFocus?: boolean;
  invalidateOnActivation?: boolean;
  clearOnInvalidate?: boolean;
  clearUnusedAfter?: Duration | null;
  resourceGroup?: ResourceGroup | ResourceGroup[];
}

export class Cache<T> extends Store<Promise<T>> {
  readonly state = createStore<CacheState<T>>({
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
      selectors: (Selector<any, any> | Path<any>)[];
    },
    _call?: (...args: any[]) => any,
  ) {
    super(getter, options, undefined, _call);
    autobind(Cache);

    this.watchPromise();
    this.watchFocus();

    this.state.addEffect(() => this.subscribe(() => undefined));
  }

  get({ update = 'whenStale', backgroundUpdate = false }: CacheGetOptions = {}) {
    const promise = this.calculatedValue?.value;
    const stalePromise = this.stalePromise;

    if (
      (update === 'whenMissing' && !promise && !stalePromise) ||
      (update === 'whenStale' && !promise) ||
      update === 'force'
    ) {
      this.calculatedValue?.stop();
      this.calculatedValue = calculatedValue(this, this.notify);
      this.notify();

      if ((!promise && !stalePromise) || !backgroundUpdate) {
        return super.get();
      }
    }

    if (!promise || (stalePromise && backgroundUpdate)) {
      return stalePromise!;
    }

    return promise;
  }

  updateValue(value: MaybePromise<T> | ((value: T) => T)) {
    if (value instanceof Function) {
      this.set(this.get().then((v) => value(v)));
    } else {
      this.set(PromiseWithState.resolve(value));
    }
  }

  updateError(error: unknown) {
    this.set(PromiseWithState.reject(error));
  }

  invalidate(recursive?: boolean) {
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

  mapValue<P extends Path<T>>(selector: P): Cache<Value<T, P>>;

  mapValue<S>(_selector: Selector<T, S> | Path<any>): Cache<S> {
    const selector = makeSelector(_selector);
    const derivedFromCache = {
      cache: this.derivedFromCache ? this.derivedFromCache.cache : this,
      selectors: this.derivedFromCache
        ? [...this.derivedFromCache.selectors, _selector]
        : [_selector],
    };

    return new Cache(
      async ({ use }) => {
        const value = await use(this);
        return selector(value);
      },
      {
        equals: this.options.equals,
      },
      derivedFromCache,
    );
  }

  protected watchPromise() {
    this.subscribe(
      async (promise) => {
        if (promise instanceof PromiseWithState && promise.state.status !== 'pending') {
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

  protected setTimers() {
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

  protected watchFocus() {
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

type CreateReturnType<T, Args extends any[]> = {
  (...args: Args): Cache<T>;
  invalidateAll: () => void;
  clearAll: () => void;
} & ([] extends Args ? Cache<T> : {});

function create<T, Args extends any[] = []>(
  cacheFunction: CacheFunction<T, Args>,
  options?: CacheOptions<T>,
): CreateReturnType<T, Args> {
  options = { ...createCache.defaultOptions, ...options };
  const { clearUnusedAfter, resourceGroup } = options ?? {};

  let baseInstance: CreateReturnType<T, Args> & Cache<T>;

  const instanceCache = new InstanceCache<Args, Cache<T>>(
    (...args: Args): Cache<T> => {
      if (args.length === 0 && baseInstance) {
        return baseInstance;
      }

      return new Cache((helpers) => {
        const result = cacheFunction.apply(helpers, args);

        if (result instanceof Function) {
          return result(helpers);
        }

        return result;
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

  baseInstance = Object.assign(
    new Cache(
      (helpers) => {
        const result = cacheFunction.apply(helpers);

        if (result instanceof Function) {
          return result(helpers);
        }

        return result;
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

  const groups = Array.isArray(resourceGroup)
    ? resourceGroup
    : resourceGroup
      ? [resourceGroup]
      : [];
  for (const group of groups.concat(allResources)) {
    group.add(baseInstance);
  }

  get(...([] as any));

  return baseInstance;
}

export const createCache = /* @__PURE__ */ Object.assign(create, {
  defaultOptions: {
    invalidateOnWindowFocus: true,
    invalidateOnActivation: true,
    clearUnusedAfter: { days: 1 },
    retain: { milliseconds: 1 },
    equals: deepEqual,
  } as CacheOptions<unknown>,
});
