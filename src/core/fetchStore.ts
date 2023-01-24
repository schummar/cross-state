import type {
  Cancel,
  Duration,
  Listener,
  Selector,
  SubscribeOptions,
  Update,
  Use,
  UseFetch,
} from './commonTypes';
import type { ResourceGroup } from './resourceGroup';
import { _allResources } from './resourceGroup';
import { Store } from './store';
import { Cache } from '@lib/cache';
import { calcDuration } from '@lib/calcDuration';
import { CalculationHelper } from '@lib/calculationHelper';
import { defaultEquals, simpleShallowEquals } from '@lib/equals';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/path';

type Common<T> =
  | { isUpdating: false; update?: undefined; ref: unknown }
  | { isUpdating: true; update: Promise<T>; ref: unknown };
type WithValue<T> = {
  status: 'value';
  value: T;
  error?: undefined;
  isStale: boolean;
} & Common<T>;
type WithError<T> = {
  status: 'error';
  value?: undefined;
  error: unknown;
  isStale: boolean;
} & Common<T>;
type Pending<T> = {
  status: 'pending';
  value?: undefined;
  error?: undefined;
  isStale: true;
} & Common<T>;
export type FetchStoreState<T> = WithValue<T> | WithError<T> | Pending<T>;

export interface FetchOptions {
  cache?: 'updateWhenStale' | 'backgroundUpdate' | 'forceUpdate';
}

export interface FetchFunction<T, Args extends any[] = []> {
  (this: { use: Use; useFetch: UseFetch }, ...args: Args): Promise<T>;
}

export interface FetchStoreOptions<T> {
  invalidateAfter?: Duration | ((state: FetchStoreState<T>) => Duration);
  clearAfter?: Duration | ((state: FetchStoreState<T>) => Duration);
  resourceGroup?: ResourceGroup | ResourceGroup[];
  retain?: number;
  clearUnusedAfter?: Duration;
  //   parentStore?: { store: Store<any>; selectors: (Selector<any, any> | string)[] };
}

const fetchStoreStateEquals =
  (equals = defaultEquals) =>
  (a: FetchStoreState<any>, b: FetchStoreState<any>) => {
    const { value: av, ...ar } = a;
    const { value: bv, ...br } = b;
    return simpleShallowEquals(ar, br) && (ar.status !== 'value' || equals(av, bv));
  };

const createRef = () => Math.random().toString(36).slice(2);

export class FetchStore<T> extends Store<FetchStoreState<T>> {
  private fetchCalculationHelper = new CalculationHelper({
    calculate: ({ use, useFetch }) => {
      const promise = this.fetchFunction.apply({ use, useFetch });
      this.setPromise(promise);
    },

    addEffect: this.addEffect,
    getValue: () => this.get().value,
    setValue: this.setValue,
    setError: this.setError,
    onInvalidate: this.invalidate,
  });

  constructor(
    protected fetchFunction: FetchFunction<T>,
    protected options: FetchStoreOptions<T> = {},
  ) {
    super({
      status: 'pending',
      isStale: true,
      isUpdating: false,
      ref: createRef(),
    });
  }

  update(value: Update<FetchStoreState<T>>): void {
    this.fetchCalculationHelper.stop();
    super.update(value);
  }

  async fetch(options?: FetchOptions): Promise<T> {
    this.fetchCalculationHelper.check();

    const { cache = 'updateWhenStale' } = options ?? {};
    const { status, value, error, update, isStale } = this.get();

    if (((status === 'pending' || isStale) && !update) || cache === 'forceUpdate') {
      this.fetchCalculationHelper.execute();

      if (status === 'pending' || cache !== 'backgroundUpdate') {
        return this.get().update!;
      }
    }

    if (status === 'value') {
      return value;
    }

    if (status === 'error') {
      throw error;
    }

    return update;
  }

  setValue(value: T | Promise<T>): void {
    if (value instanceof Promise) {
      this.fetchCalculationHelper.stop();
      this.setPromise(value);
    } else {
      this.update({
        status: 'value',
        value,
        isStale: false,
        isUpdating: false,
        ref: createRef(),
      });
    }
  }

  protected setPromise(promise: Promise<T>) {
    const ref = createRef();

    super.update({
      ...this.get(),
      isUpdating: true,
      update: promise,
      ref,
    });

    promise
      .then((value) => {
        if (promise === this.get().update) {
          super.update({
            status: 'value',
            value,
            isStale: false,
            isUpdating: false,
            ref,
          });
        }
      })
      .catch((error) => {
        if (promise === this.get().update) {
          super.update({
            status: 'error',
            error,
            isStale: false,
            isUpdating: false,
            ref,
          });
        }
      });
  }

  setError(error: unknown): void {
    this.update({
      status: 'error',
      error,
      isStale: false,
      isUpdating: false,
      ref: createRef(),
    });
  }

  invalidate(): void {
    this.update({
      ...this.get(),
      isStale: true,
      isUpdating: false,
      update: undefined,
    });

    if (this.isActive) {
      this.fetchCalculationHelper.execute();
    }
  }

  clear(): void {
    this.update({
      status: 'pending',
      isStale: true,
      isUpdating: false,
      ref: createRef(),
    });

    if (this.isActive) {
      this.fetchCalculationHelper.execute();
    }
  }

  sub(listener: Listener<FetchStoreState<T>>, options?: SubscribeOptions): Cancel {
    return super.sub(listener, {
      ...options,
      equals: fetchStoreStateEquals(options?.equals),
    });
  }

  mapValue<S>(selector: Selector<T, S>): FetchStore<S>;

  mapValue<P extends Path<T>>(selector: P): FetchStore<Value<T, P>>;

  mapValue<S>(_selector: Selector<T, S> | Path<any>): FetchStore<S> {
    const selector = makeSelector(_selector);
    const that = this;

    return new FetchStore(async function () {
      const value: T = await this.useFetch(that);
      return selector(value);
    });
  }
}

const defaultOptions: FetchStoreOptions<unknown> = {};

function create<T>(fetch: FetchFunction<T>, options?: FetchStoreOptions<T>): FetchStore<T> {
  return withArgs(fetch, options)();
}

function withArgs<T, Args extends any[]>(
  fetch: FetchFunction<T, Args>,
  options?: FetchStoreOptions<T>,
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
  for (const group of groups.concat(_allResources)) {
    group.add(resource);
  }

  return Object.assign(get, resource);
}

export const fetchStore = Object.assign(create, {
  withArgs,
  defaultOptions,
});
