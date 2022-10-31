import { Cache, calcDuration } from '../lib';
import { trackingProxy } from '../lib/trackingProxy';
import type { Duration, Use } from './commonTypes';
import type { ResourceGroup } from './resourceGroup';
import { allResources } from './resourceGroup';
import { Store } from './store';

type Common<T> = { promise?: Promise<T>; isStale: boolean };
type WithValue<T> = { status: 'value'; value: T; error?: undefined } & Common<T>;
type WithError<T> = { status: 'error'; value?: undefined; error: unknown } & Common<T>;
type Pending<T> = { status: 'pending'; value?: undefined; error?: undefined } & Common<T>;
export type FetchStoreState<T> = WithValue<T> | WithError<T> | Pending<T>;

export interface FetchOptions {
  cache?: 'updateWhenStale' | 'backgroundUpdate' | 'forceUpdate';
}

export interface FetchFn<T, Args extends any[] = []> {
  (this: { use: Use }, ...args: Args): Promise<T>;
}

export interface FetchStoreOptions<T> {
  invalidateAfter?: Duration | ((state: FetchStoreState<T>) => Duration);
  clearAfter?: Duration | ((state: FetchStoreState<T>) => Duration);
  resourceGroup?: ResourceGroup | ResourceGroup[];
  retain?: number;
  clearUnusedAfter?: Duration;
  //   parentStore?: { store: Store<any>; selectors: (Selector<any, any> | string)[] };
}

class FetchStore<T> extends Store<FetchStoreState<T>> {
  checkValidity?: () => void;
  cleanupExecute?: () => void;

  constructor(protected fetchFn: FetchFn<T>) {
    super({
      status: 'pending',
      isStale: true,
    });

    this.addEffect(() => {
      this.fetch().catch(() => undefined);

      return () => {
        this.cleanupExecute?.();
      };
    });
  }

  fetch(options?: FetchOptions): Promise<T> {
    this.checkValidity?.();

    const { cache = 'updateWhenStale' } = options ?? {};
    const { promise, isStale } = this.get();

    if (!promise || isStale || cache === 'forceUpdate') {
      const newPromise = this.execute();

      if (!promise || cache !== 'backgroundUpdate') {
        return newPromise;
      }
    }

    return promise;
  }

  setValue(value: T | Promise<T>): void {
    if (value instanceof Promise) {
      this.set({
        ...this.get(),
        promise: value,
        isStale: false,
      });
    } else {
      this.set({
        status: 'value',
        value,
        isStale: false,
      });
    }
  }

  setError(error: unknown): void {
    this.set({
      status: 'error',
      error,
      isStale: false,
    });
  }

  invalidate(): void {
    this.set({
      ...this.get(),
      promise: undefined,
      isStale: true,
    });

    if (this.isActive) {
      this.execute().catch(() => undefined);
    }
  }

  clear(): void {
    this.set({
      status: 'pending',
      isStale: true,
    });

    if (this.isActive) {
      this.execute().catch(() => undefined);
    }
  }

  private async execute() {
    this.cleanupExecute?.();

    const checks = new Array<() => boolean>();
    const deps = new Set<Store<any>>();
    const subs = new Array<() => void>();
    let promise: Promise<T> | undefined;

    const cancelEffect = this.addEffect(() => {
      for (const store of deps) {
        const sub = store.sub(checkValidity, { runNow: false });
        subs.push(sub);
      }

      return () => {
        subs.forEach((handle) => handle());
        subs.length = 0;
      };
    });

    const checkValidity = () => {
      if (!checks.every((check) => check())) {
        this.invalidate();
      }
    };

    const cleanupExecute = () => {
      cancelEffect();
      delete this.checkValidity;
      delete this.cleanupExecute;
      subs.forEach((handle) => handle());
    };

    try {
      promise = this.fetchFn.apply({
        use: (store, { disableProxy } = {}) => {
          let value = store.get();
          let equals = (newValue: any) => newValue === value;

          if (!disableProxy) {
            [value, equals] = trackingProxy(value);
          }

          checks.push(() => equals(store.get()));
          deps.add(store);

          if (this.isActive && (!promise || promise === this.get().promise)) {
            const sub = store.sub(checkValidity, { runNow: false });
            subs.push(sub);
          }

          return value;
        },
      });
    } catch (error) {
      promise = Promise.reject(error);
    }

    this.setValue(promise);
    this.checkValidity = checkValidity;
    this.cleanupExecute = cleanupExecute;

    return promise;
  }
}

const defaultOptions: FetchStoreOptions<unknown> = {};

function _fetchStore<T, Args extends any[]>(
  fetch: FetchFn<T, Args>,
  options?: FetchStoreOptions<T>
): {
  (...args: Args): FetchStore<T>;
  invalidate: () => void;
  clear: () => void;
} {
  const { clearUnusedAfter = defaultOptions.clearUnusedAfter ?? 0, resourceGroup } = options ?? {};

  const cache = new Cache(
    (...args: Args) =>
      new FetchStore(function () {
        return fetch.apply(this, args);
      }),
    calcDuration(clearUnusedAfter)
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
  const groups = Array.isArray(resourceGroup) ? resourceGroup : resourceGroup ? [resourceGroup] : [];
  for (const group of groups.concat(allResources)) {
    group.add(resource);
  }

  return Object.assign(get, resource);
}

export const fetchStore = Object.assign(_fetchStore, {
  defaultOptions,
});
