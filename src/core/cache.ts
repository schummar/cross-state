import type { MakeOptional, ReadStore } from '@core/commonTypes';
import { Computed, type ComputedDependencies } from '@core/store';
import { calcDuration } from '@lib/duration';
import { InstanceCache } from '@lib/instanceCache';

interface CacheOptions<T, TArgs extends any[], TDeps extends any[]> {
  args: TArgs;
  dependencies: ComputedDependencies<TDeps>;
  fetch: (...args: [...TArgs, ...TDeps]) => Promise<T>;
  getCacheKey?: (...args: TArgs) => unknown;
}

type CacheOptionsInput<T, TArgs extends any[], TDeps extends any[]> = TDeps extends []
  ? MakeOptional<Omit<CacheOptions<T, TArgs, TDeps>, 'args'>, 'dependencies'>
  : Omit<CacheOptions<T, TArgs, TDeps>, 'args'>;

class Cache<T, TArgs extends any[], TDeps extends any[]>
  extends Computed<Promise<T>, TDeps>
  implements ReadStore<Promise<T>>
{
  constructor(protected cacheOptions: CacheOptions<T, TArgs, TDeps>) {
    super({
      dependencies: cacheOptions.dependencies as ComputedDependencies<TDeps>,
      compute: (...deps) => cacheOptions.fetch(...cacheOptions.args, ...deps),
    });
  }
}

type CacheBundle<T, TArgs extends any[], TDeps extends any[]> = {
  (...args: TArgs): Cache<T, TArgs, TDeps>;
  invalidateAll(): void;
} & ([] extends TArgs ? Cache<T, TArgs, TDeps> : {});

function createCache<T, TArgs extends any[] = []>(
  fetch: (...args: TArgs) => Promise<T>,
): CacheBundle<T, TArgs, []>;
function createCache<T, TArgs extends any[] = [], TDeps extends any[] = []>(
  options: CacheOptionsInput<T, TArgs, TDeps>,
): CacheBundle<T, TArgs, TDeps>;
function createCache<T, TArgs extends any[], TDeps extends any[]>(
  arg: ((...args: TArgs) => Promise<T>) | CacheOptionsInput<T, TArgs, TDeps>,
): CacheBundle<T, TArgs, TDeps> {
  let options: Omit<CacheOptions<T, TArgs, TDeps>, 'args'>;

  if (typeof arg === 'function') {
    options = {
      dependencies: [] as ComputedDependencies<TDeps>,
      fetch: arg as unknown as (...args: [...TArgs, ...TDeps]) => Promise<T>,
    };
  } else {
    options = {
      dependencies: (arg.dependencies ?? []) as ComputedDependencies<TDeps>,
      fetch: arg.fetch as unknown as (...args: [...TArgs, ...TDeps]) => Promise<T>,
    };
  }

  const instanceCache = new InstanceCache<TArgs, Cache<T, TArgs, TDeps>>(
    (...args) =>
      new Cache<T, TArgs, TDeps>({
        ...options,
        args,
      }),
    calcDuration({ hours: 1 }),
  );

  function get(...args: TArgs) {
    const sliceAfter = args.lastIndexOf(undefined);
    if (sliceAfter !== -1) {
      args = args.slice(0, sliceAfter) as TArgs;
    }

    const cacheKey = options?.getCacheKey ? options.getCacheKey(...args) : args;
    return instanceCache.getWithKey(args, cacheKey);
  }

  const bundle = new Proxy(
    Object.assign(() => void 0, {
      invalidateAll() {
        for (const cache of instanceCache.values()) {
          cache.invalidate();
        }
      },
    }),
    {
      apply(_target, _thisArg, args: TArgs) {
        return get(...args);
      },
      get(target, prop, receiver) {
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }

        const baseCache = get(...([] as unknown as TArgs));
        return Reflect.get(baseCache, prop, baseCache);
      },
    },
  ) as unknown as CacheBundle<T, TArgs, TDeps>;

  return bundle;
}
