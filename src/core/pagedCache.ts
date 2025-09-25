import {
  Cache,
  defaultCacheOptions,
  internalCreate,
  type CacheOptions,
  type CreateCacheResult,
} from '@core/cache';
import type { CalculationActions } from '@core/commonTypes';
import { autobind } from '@lib/autobind';

export interface PageCacheFunctionProps<T> extends CalculationActions<Promise<PagedState<T>>> {
  pages: T[];
  prevPage: T | null;
}

export interface PageCacheFunction<T> {
  (props: PageCacheFunctionProps<T>): Promise<T | null>;
}

export interface PagedCacheDefinition<T> {
  fetchPage: (props: PageCacheFunctionProps<T>) => Promise<T | null>;
  getPageCount?: (pages: T[]) => number | null;
  hasMorePages?: (pages: T[]) => boolean;
}

export interface PagedCacheDefinitionFunction<T, Args extends any[]> {
  (...args: Args): PagedCacheDefinition<T>;
}

export interface PagedState<T> {
  pages: T[];
  hasMore: boolean;
  pageCount: number | null;
}

export interface FetchNextPageOptions {
  ignoreErrors?: boolean;
}

export class PagedCache<T, Args extends any[] = []> extends Cache<PagedState<T>, Args> {
  constructor(
    public readonly definition: PagedCacheDefinition<T>,
    args: Args,
    options: CacheOptions<PagedState<T>, Args> = {},
  ) {
    super(async (helpers) => loadPage(definition, helpers, []), args, options, undefined);
    autobind(PagedCache);
  }

  async fetchNextPage({ ignoreErrors }: FetchNextPageOptions = {}): Promise<void> {
    const { status, isStale, isUpdating, value } = this.state.get();

    if (status === 'error') {
      if (ignoreErrors) return;
      throw new Error('Cannot fetch next page while cache is in error state');
    }

    if (isUpdating) {
      if (ignoreErrors) return;
      throw new Error('Cannot fetch next page while another page is being fetched');
    }

    if (status === 'pending' || isStale) {
      await this.get().catch(() => {});
      return;
    }

    this.stalePromise = this.calculatedValue?.value;

    const ac = new AbortController();
    const promise = loadPage(
      this.definition,
      {
        use() {
          throw new Error('Not implemented');
        },
        connect() {
          throw new Error('Not implemented');
        },
        signal: ac.signal,
      },
      value.pages,
    );

    this.updateValue(promise);

    try {
      await promise;
    } catch (error) {
      if (ignoreErrors) return;
      throw error;
    }
  }
}

async function loadPage<T>(
  { fetchPage, hasMorePages, getPageCount }: PagedCacheDefinition<T>,
  helpers: CalculationActions<Promise<PagedState<T>>>,
  oldPages: T[],
) {
  const page = await fetchPage({
    ...helpers,
    pages: oldPages,
    prevPage: oldPages.length > 0 ? oldPages[oldPages.length - 1]! : null,
  });

  const pages = page === null ? oldPages : oldPages.concat(page);
  const pageCount = getPageCount?.(pages) ?? null;
  const hasMore =
    page === null
      ? false
      : hasMorePages
        ? hasMorePages(pages)
        : pageCount !== null
          ? pages.length < pageCount
          : true;

  return { pages, hasMore, pageCount };
}

function createPaged<T, Args extends any[] = []>(
  definition: PagedCacheDefinitionFunction<T, Args>,
  options?: CacheOptions<PagedState<T>, Args>,
): CreateCacheResult<PagedState<T>, Args, PagedCache<T, Args>>;

function createPaged<T>(
  definition: PagedCacheDefinition<T>,
  options?: CacheOptions<PagedState<T>, []>,
): CreateCacheResult<PagedState<T>, [], PagedCache<T, []>>;

function createPaged<T, Args extends any[] = []>(
  definition: PagedCacheDefinitionFunction<T, Args> | PagedCacheDefinition<T>,
  options?: CacheOptions<PagedState<T>, Args>,
): CreateCacheResult<PagedState<T>, Args, PagedCache<T, Args>> {
  return internalCreate<PagedState<T>, Args, PagedCache<T, Args>>((args, options) => {
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
