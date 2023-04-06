import {
  type CalculationHelpers,
  type Cancel,
  type ConnectionState,
  type Duration,
  type Selector,
} from './commonTypes';
import { allResources, type ResourceGroup } from './resourceGroup';
import { createStore, Store } from './store';
import { calcDuration } from '@lib/calcDuration';
import { InstanceCache } from '@lib/instanceCache';
import { type Path } from '@lib/path';

export interface SubscriptionCacheFunction<T, Args extends any[] = []> {
  (this: CalculationHelpers<T | undefined>, ...args: Args):
    | Cancel
    | void
    | ((cache: CalculationHelpers<T | undefined>) => Cancel | void);
}

export interface SubstriptionCacheOptions {
  clearOnInvalidate?: boolean;
  clearUnusedAfter?: Duration | null;
  resourceGroup?: ResourceGroup | ResourceGroup[];
  retain?: Duration;
}

export class SubstriptionCache<T> extends Store<T | undefined> {
  readonly state = createStore({
    connectionState: 'closed' as ConnectionState,
    error: undefined as unknown | undefined,
  });

  constructor(
    public readonly connectFunction: SubscriptionCacheFunction<T>,
    public readonly options: SubstriptionCacheOptions = {},
    public readonly derivedFromSubscriptionCache?: {
      subscriptionCache: SubstriptionCache<any>;
      selectors: (Selector<any, any> | Path<any>)[];
    },
    _call?: (...args: any[]) => any,
  ) {
    super(undefined, options, undefined, _call);

    this.calculationHelper.options = {
      ...this.calculationHelper.options,
      calculate: (helpers) => {
        let result = connectFunction.apply(helpers);

        if (result instanceof Function && result.length > 0) {
          result = result(helpers);
        }

        return result as Cancel | void;
      },
      onValue: (value) => {
        this.set(value);
      },
      onError: (error) => {
        this.state.set('error', error);
      },
      onConnectionState: (state) => {
        this.state.set('connectionState', state);
      },
      onInvalidate: () => {
        this.invalidate();
      },
    };
  }

  invalidate({ invalidateDependencies = true }: { invalidateDependencies?: boolean } = {}) {
    const { clearOnInvalidate = defaultOptions.clearOnInvalidate } = this.options;

    if (clearOnInvalidate) {
      return this.clear({ invalidateDependencies });
    }

    if (invalidateDependencies) {
      this.calculationHelper.invalidateDependencies();
    }

    this.calculationHelper.stop();

    if (this.isActive()) {
      this.calculationHelper.execute();
    }
  }

  clear({ invalidateDependencies = true }: { invalidateDependencies?: boolean } = {}): void {
    if (invalidateDependencies) {
      this.calculationHelper.invalidateDependencies();
    }

    this.calculationHelper.stop();

    if (this.isActive()) {
      this.calculationHelper.execute();
    }
  }
}

const defaultOptions: SubstriptionCacheOptions = {
  clearUnusedAfter: { days: 1 },
  retain: { seconds: 1 },
};

type CreateReturnType<T, Args extends any[]> = {
  (...args: Args): SubstriptionCache<T>;
  invalidateAll: () => void;
  clearAll: () => void;
} & ([] extends Args ? SubstriptionCache<T> : {});

function create<T, Args extends any[] = []>(
  cacheFunction: SubscriptionCacheFunction<T, Args>,
  options?: SubstriptionCacheOptions,
): CreateReturnType<T, Args> {
  const { clearUnusedAfter = defaultOptions.clearUnusedAfter, resourceGroup } = options ?? {};

  let baseInstance: CreateReturnType<T, Args> & SubstriptionCache<T>;

  const instanceCache = new InstanceCache<Args, SubstriptionCache<T>>(
    (...args: Args): SubstriptionCache<T> => {
      if (args.length === 0 && baseInstance) {
        return baseInstance;
      }

      return new SubstriptionCache(function () {
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

  baseInstance = Object.assign(
    new SubstriptionCache<T>(
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
  ) as CreateReturnType<T, Args> & SubstriptionCache<T>;

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

export const createSubscriptionCache = /* @__PURE__ */ Object.assign(create, {
  defaultOptions,
});
