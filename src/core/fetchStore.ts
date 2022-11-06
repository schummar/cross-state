import { CalculationHelper } from '@lib/calculationHelper';
import { defaultEquals, simpleShallowEquals } from '@lib/equals';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/propAccess';
import { Cache, calcDuration } from '../lib';
import type { Cancel, Duration, Listener, Selector, SubscribeOptions, Update, Use, UseFetch } from './commonTypes';
import { DerivedStore } from './derivedStore';
import type { ResourceGroup } from './resourceGroup';
import { allResources } from './resourceGroup';
import { Store } from './store';

type Common<T> = { updating?: Promise<T>; isStale: boolean };
type WithValue<T> = { status: 'value'; value: T; error?: undefined } & Common<T>;
type WithError<T> = { status: 'error'; value?: undefined; error: unknown } & Common<T>;
type Pending<T> = { status: 'pending'; value?: undefined; error?: undefined } & Common<T>;
export type FetchStoreState<T> = WithValue<T> | WithError<T> | Pending<T>;

export interface FetchOptions {
  cache?: 'updateWhenStale' | 'backgroundUpdate' | 'forceUpdate';
}

export interface FetchFn<T, Args extends any[] = []> {
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

export class FetchStore<T> extends Store<FetchStoreState<T>> {
  calculationHelper = new CalculationHelper({
    calculate: ({ use, useFetch }) => {
      const promise = this.fetchFn.apply({ use, useFetch });
      this.setPromise(promise);
    },

    addEffect: this.addEffect,
    getValue: () => this.value.value,
    setValue: this.setValue,
    setError: this.setError,
    onInvalidate: this.invalidate,
  });

  constructor(protected fetchFn: FetchFn<T>, protected options: FetchStoreOptions<T> = {}) {
    super({
      status: 'pending',
      isStale: true,
    });

    this.addEffect(() => {
      this.calculationHelper.execute();
    });
  }

  update(value: Update<FetchStoreState<T>>): void {
    this.calculationHelper.stop();
    super.update(value);
  }

  async fetch(options?: FetchOptions): Promise<T> {
    this.calculationHelper.check();

    const { cache = 'updateWhenStale' } = options ?? {};
    const { status, value, error, updating, isStale } = this.value;

    if ((isStale && !updating) || cache === 'forceUpdate') {
      this.calculationHelper.execute();

      if (status === 'pending' || cache !== 'backgroundUpdate') {
        return this.value.updating!;
      }
    }

    if (status === 'value') {
      return value;
    }

    throw error;
  }

  setValue(value: T | Promise<T>): void {
    if (value instanceof Promise) {
      this.setPromise(value);
    } else {
      this.update({
        status: 'value',
        value,
        isStale: false,
      });
    }
  }

  private setPromise(promise: Promise<T>) {
    this.update({
      ...this.value,
      updating: promise,
    });

    promise
      .then((value) => {
        if (promise === this.value.updating) {
          this.setValue(value);
        }
      })
      .catch((error) => {
        if (promise === this.value.updating) {
          this.setError(error);
        }
      });
  }

  setError(error: unknown): void {
    this.update({
      status: 'error',
      error,
      isStale: false,
    });
  }

  invalidate(): void {
    this.update({
      ...this.value,
      updating: undefined,
      isStale: true,
    });

    if (this.isActive()) {
      this.calculationHelper.execute();
    }
  }

  clear(): void {
    this.update({
      status: 'pending',
      isStale: true,
    });

    if (this.isActive()) {
      this.calculationHelper.execute();
    }
  }

  sub(listener: Listener<FetchStoreState<T>>, options?: SubscribeOptions | undefined): Cancel {
    return super.sub(listener, {
      ...options,
      equals: fetchStoreStateEquals(options?.equals),
    });
  }

  mapValue<S>(selector: Selector<T, S>): FetchStore<S>;
  mapValue<P extends Path<T>>(selector: P): FetchStore<Value<T, P>>;
  mapValue<S>(_selector: Selector<T, S> | string): FetchStore<S> {
    const selector = makeSelector(_selector);
    const that = this;

    return new FetchStore(async function () {
      const value: T = await this.useFetch(that);
      return selector(value);
    });

    // const parentStore = {
    //   store: this.options.parentStore?.store ?? (this as Store<any, any>),
    //   selectors: this.options.parentStore?.selectors.slice() ?? [],
    // };
    // parentStore.selectors.push(_selector);

    // return store(
    //   ({ use }) => {
    //     const value = use(this);

    //     if (value instanceof Promise) {
    //       return value.then((value) => selector(value as UnwrapPromise<T>));
    //     }

    //     return selector(value as UnwrapPromise<T>);
    //   },
    //   {
    //     parentStore,
    //   }
    // );
  }
}

const defaultOptions: FetchStoreOptions<unknown> = {};

function create<T>(fetch: FetchFn<T>, options?: FetchStoreOptions<T>): FetchStore<T> {
  return new FetchStore(fetch, options);
}

function withArgs<T, Args extends any[]>(
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
      }, options),
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

  const withoutArgs = (fetch.length === 0 ? (get as () => FetchStore<T>)() : {}) as Args extends [] ? FetchStore<T> : Record<string, never>;

  return Object.assign(get, withoutArgs, resource);
}

export const fetchStore = Object.assign(create, {
  withArgs,
  defaultOptions,
});
