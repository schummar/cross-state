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
  /**
   * Previously fetched pages (in order).
   */
  pages: T[];
  /**
   * Last fetched page or null if there are no previously fetched pages.
   */
  prevPage: T | null;
}

export interface PageCacheFunction<T> {
  (props: PageCacheFunctionProps<T>): Promise<T | null>;
}

export interface PagedCacheDefinition<T, Args extends any[]> {
  /**
   * Function to fetch a page.
   * The function receives the current state of the cache, including previously fetched pages.
   */
  fetchPage: (this: PagedCache<T, Args>, props: PageCacheFunctionProps<T>) => Promise<T | null>;
  /**
   * Optional function to determine the total number of pages - usually based on data in the fetched pages.
   */
  getPageCount?: (this: PagedCache<T, Args>, pages: T[]) => number | null;
  /**
   * Optional function to determine if there are more pages to fetch - usually based on data in the fetched pages.
   * If not provided, it will be assumed there are more pages until getPageCount is provided and the number of fetched pages equals the page count or until fetchPage returns null.
   */
  hasMorePages?: (this: PagedCache<T, Args>, pages: T[]) => boolean;
}

export interface PagedCacheDefinitionFunction<T, Args extends any[]> {
  (...args: Args): PagedCacheDefinition<T, Args>;
}

export interface PagedState<T> {
  pages: T[];
  hasMore: boolean;
  pageCount: number | null;
}

export interface FetchNextPageOptions {
  /**
   * If true, will throw if the cache is in an error state or if another page is being fetched.
   */
  throwOnError?: boolean;
}

export class PagedCache<T, Args extends any[] = []> extends Cache<PagedState<T>, Args> {
  constructor(
    public readonly definition: PagedCacheDefinition<T, Args>,
    args: Args,
    options: CacheOptions<PagedState<T>, Args> = {},
  ) {
    super(async (helpers) => loadPage(this, helpers, []), args, options, undefined);
    autobind(PagedCache);
  }

  async fetchNextPage({ throwOnError }: FetchNextPageOptions = {}): Promise<void> {
    const { status, isStale, isUpdating, value } = this.state.get();

    if (status === 'error') {
      if (!throwOnError) return;
      throw new Error('Cannot fetch next page while cache is in error state');
    }

    if (isUpdating) {
      if (!throwOnError) return;
      throw new Error('Cannot fetch next page while another page is being fetched');
    }

    if (status === 'pending' || isStale) {
      await this.get().catch(() => {});
      return;
    }

    if (!value.hasMore) {
      if (!throwOnError) return;
      throw new Error('No more pages to fetch');
    }

    this.stalePromise = this.calculatedValue?.value;

    const ac = new AbortController();
    const promise = loadPage(
      this,
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
      if (!throwOnError) return;
      throw error;
    }
  }
}

async function loadPage<T, Args extends any[]>(
  cache: PagedCache<T, Args>,
  helpers: CalculationActions<Promise<PagedState<T>>>,
  oldPages: T[],
) {
  const { fetchPage, hasMorePages, getPageCount } = cache.definition;

  const page = await fetchPage.call(cache, {
    ...helpers,
    pages: oldPages,
    prevPage: oldPages.length > 0 ? oldPages[oldPages.length - 1]! : null,
  });

  const pages = page === null ? oldPages : oldPages.concat(page);
  const pageCount = getPageCount?.call(cache, pages) ?? null;
  const hasMore = hasMorePages
    ? hasMorePages.call(cache, pages)
    : pageCount !== null
      ? pages.length < pageCount
      : page !== null;

  return { pages, hasMore, pageCount };
}

function createPaged<T, Args extends any[] = []>(
  definition: PagedCacheDefinitionFunction<T, Args>,
  options?: CacheOptions<PagedState<T>, Args>,
): CreateCacheResult<PagedState<T>, Args, PagedCache<T, Args>>;

function createPaged<T>(
  definition: PagedCacheDefinition<T, []>,
  options?: CacheOptions<PagedState<T>, []>,
): CreateCacheResult<PagedState<T>, [], PagedCache<T, []>>;

function createPaged<T, Args extends any[] = []>(
  definition: PagedCacheDefinitionFunction<T, Args> | PagedCacheDefinition<T, Args>,
  options?: CacheOptions<PagedState<T>, Args>,
): CreateCacheResult<PagedState<T>, Args, PagedCache<T, Args>> {
  return internalCreate<PagedState<T>, Args, PagedCache<T, Args>>((args, options) => {
    let currentDefinition = definition;
    if (currentDefinition instanceof Function) {
      currentDefinition = currentDefinition(...args);
    }
    return new PagedCache(currentDefinition, args, options);
  }, options);
}

export const createPagedCache: typeof createPaged & { defaultOptions: CacheOptions<any, any> } =
  /* @__PURE__ */ Object.assign(createPaged, {
    defaultOptions: defaultCacheOptions,
  });
