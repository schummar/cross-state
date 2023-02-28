import type { Duration, Selector, Update, Use } from './commonTypes';
import type { ResourceGroup } from './resourceGroup';
import { _allResources } from './resourceGroup';
import type { StoreOptions } from './store';
import { store, Store } from './store';
import { Cache } from '@lib/cache';
import { calcDuration } from '@lib/calcDuration';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/path';
import type { ErrorState, ValueState } from '@lib/state';
import type { TrackedPromise } from '@lib/trackedPromise';
import { trackPromise } from '@lib/trackedPromise';

export interface FetchOptions {
  update?: 'whenMissing' | 'whenStale' | 'force';
  backgroundUpdate?: boolean;
}

export interface FetchFunction<T, Args extends any[] = []> {
  (this: { use: Use }, ...args: Args): Promise<T>;
}

export interface FetchStoreOptions<T> {
  invalidateAfter?: Duration | ((state: ValueState<T> | ErrorState) => Duration);
  clearAfter?: Duration | ((state: ValueState<T> | ErrorState) => Duration);
  resourceGroup?: ResourceGroup | ResourceGroup[];
  retain?: number;
  clearUnusedAfter?: Duration;
}

export class FetchStore<T> extends Store<TrackedPromise<T>> {
  staleValue = store<(TrackedPromise<T> & { status: 'value' | 'error' }) | undefined>(undefined);

  constructor(
    getter: FetchFunction<T>,
    options?: StoreOptions,
    derivedFrom?: { store: Store<any>; selectors: (Selector<any, any> | Path<any>)[] },
  ) {
    super(
      function () {
        const value = getter.apply(this);
        return trackPromise(value);
      },
      options,
      derivedFrom,
    );

    this.sub(
      (promise) => {
        promise
          .finally(() => {
            if (this._value?.v === promise) {
              this.staleValue.set(undefined);
              this.notify();
            }
          })
          .catch(() => undefined);
      },
      { passive: true },
    );
  }

  get({ update = 'whenStale', backgroundUpdate = false }: FetchOptions = {}) {
    const value = this._value?.v;
    const staleValue = this.staleValue.get();

    if (
      (update === 'whenMissing' && !value && !staleValue) ||
      (update === 'whenStale' && !value) ||
      update === 'force'
    ) {
      this.invalidate();
      const newValue = super.get();

      if ((!value && !staleValue) || !backgroundUpdate) {
        return newValue;
      }
    }

    if (!value || (value.status === 'pending' && backgroundUpdate)) {
      return staleValue!;
    }

    return value;
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
    if (this._value?.v && this._value.v.status !== 'pending') {
      this.staleValue.set(this._value.v);
    } else {
      this.staleValue.set(undefined);
    }

    super.reset();
  }

  clear(): void {
    super.reset();
  }

  mapValue<S>(selector: Selector<T, S>): FetchStore<S>;

  mapValue<P extends Path<T>>(selector: P): FetchStore<Value<T, P>>;

  mapValue<S>(_selector: Selector<T, S> | Path<any>): FetchStore<S> {
    const selector = makeSelector(_selector);
    const that = this;

    return new FetchStore(async function () {
      const value = await this.use(that);
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
