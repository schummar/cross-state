import { CacheState } from '@lib/cacheState';
import { Path } from '@lib/path';
import { Cancel, Duration, Selector, UpdateFrom, Use } from './commonTypes';
import { createStore, Store } from './store';

export interface SubscriptionCacheFuncion<T, Args extends any[] = []> {
  (
    this: {
      use: Use;
      updateValue: (update: UpdateFrom<T, [T | undefined]>) => void;
      updateError: (error: unknown) => void;
    },
    ...args: Args
  ): Cancel;
}

export interface SubstriptionCacheOptions<T> {
  clearUnusedAfter?: Duration | null;
  retain?: number;
}

export class SubstriptionCache<T> extends Store<T | undefined> {
  readonly state = createStore<CacheState<T>>({
    status: 'pending',
    isStale: true,
    isUpdating: false,
  });

  constructor(
    getter: SubscriptionCacheFuncion<T>,
    public readonly options: SubstriptionCacheOptions<T> = {},
    public readonly derivedFromSubscriptionCache?: {
      subscriptionCache: SubstriptionCache<any>;
      selectors: (Selector<any, any> | Path<any>)[];
    },
    _call?: (...args: any[]) => any,
  ) {
    super(getter, options, undefined, _call);
  }
}
