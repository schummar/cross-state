import {
  Cache,
  defaultCacheOptions,
  internalCreate,
  type CacheOptions,
  type CreateCacheResult,
} from '@core/cache';
import type { CalculationActions } from '@core/commonTypes';
import { autobind } from '@lib/autobind';

export interface PageCacheFunctionProps<T> extends CalculationActions<Promise<T[]>> {
  pages: T[];
  prevPage: T | null;
}

export interface PageCacheFunction<T> {
  (props: PageCacheFunctionProps<T>): Promise<T | null>;
}

export interface PagedCacheDefinition<T> {
  fetchPage: (props: PageCacheFunctionProps<T>) => Promise<T | null>;
}

export interface PagedCacheDefinitionFunction<T, Args extends any[]> {
  (...args: Args): PagedCacheDefinition<T>;
}

export class PagedCache<T, Args extends any[] = []> extends Cache<T[], Args> {
  constructor(
    public readonly definition: PagedCacheDefinition<T>,
    args: Args,
    options: CacheOptions<T[], Args> = {},
  ) {
    super(
      async (helpers) => {
        const { fetchPage } = definition;

        const page = await fetchPage({
          ...helpers,
          pages: [],
          prevPage: null,
        });

        return page === null ? [] : [page];
      },
      args,
      options,
      undefined,
    );
    autobind(PagedCache);
  }

  async fetchNextPage(): Promise<T | null> {
    const { fetchPage } = this.definition;
    const { status, isStale, isUpdating, value } = this.state.get();

    if (status !== 'value' || isStale || isUpdating) {
      throw new Error('Cannot fetch next page while cache is not in a stable state');
    }

    this.stalePromise = this.calculatedValue?.value;

    const ac = new AbortController();
    const pagePromise = fetchPage({
      use() {
        throw new Error('Not implemented');
      },
      connect() {
        throw new Error('Not implemented');
      },
      signal: ac.signal,
      pages: value,
      prevPage: value.length > 0 ? value[value.length - 1]! : null,
    });

    const valuePromise = pagePromise.then((page) => {
      if (page === null) {
        return value;
      }
      return [...value, page];
    });

    this.updateValue(valuePromise);
    return pagePromise;
  }
}

function createPaged<T, Args extends any[] = []>(
  definition: PagedCacheDefinitionFunction<T, Args>,
  options?: CacheOptions<T[], Args>,
): CreateCacheResult<T[], Args, PagedCache<T, Args>>;

function createPaged<T>(
  definition: PagedCacheDefinition<T>,
  options?: CacheOptions<T[], []>,
): CreateCacheResult<T[], [], PagedCache<T, []>>;

function createPaged<T, Args extends any[] = []>(
  definition: PagedCacheDefinitionFunction<T, Args> | PagedCacheDefinition<T>,
  options?: CacheOptions<T[], Args>,
): CreateCacheResult<T[], Args, PagedCache<T, Args>> {
  return internalCreate<T[], Args, PagedCache<T, Args>>((args, options) => {
    if (definition instanceof Function) {
      definition = definition(...args);
    }
    return new PagedCache(definition, args, options);
  }, options);
}

export const createPagedCache: typeof createPaged & { defaultOptions: CacheOptions<any, any> } =
  /* @__PURE__ */ Object.assign(createPaged, {
    defaultOptions: defaultCacheOptions,
  });
