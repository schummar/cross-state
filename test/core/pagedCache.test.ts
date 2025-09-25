import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createCache } from '../../src/core/cache';
import { createPagedCache, PagedCache } from '../../src/core/pagedCache';

const originalDefaultOptions = { ...createCache.defaultOptions };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  createCache.defaultOptions = { ...originalDefaultOptions };
});

describe('pageCache', () => {
  describe('create', () => {
    test('without args', () => {
      const cache = createPagedCache<number>({ fetchPage: async () => 1 });
      expect(cache()).toBeInstanceOf(PagedCache);
    });

    test('with args', async () => {
      const cache = createPagedCache<string, [string]>((id) => ({
        async fetchPage({ pages }) {
          return id + pages.length;
        },
      }));
      await expect(cache('item-').get()).resolves.toStrictEqual({
        pages: ['item-0'],
        hasMore: true,
        pageCount: null,
      });
    });
  });

  describe('get', () => {
    test('without options', async () => {
      const cache = createPagedCache({ fetchPage: async () => 1 });
      const promise = cache.get();

      await expect(promise).resolves.toStrictEqual({ pages: [1], hasMore: true, pageCount: null });
    });

    test('returns the same promise', async () => {
      const cache = createPagedCache({ fetchPage: async () => 1 });
      const promise1 = cache.get();
      const promise2 = cache.get();

      await promise1;
      const promise3 = cache.get();

      expect(promise1).toBe(promise2);
      expect(promise1).toBe(promise3);
    });

    test('executes getter only once', async () => {
      const getter = vi.fn(async () => 1);
      const cache = createPagedCache({ fetchPage: getter });
      const promise1 = cache.get();
      cache.get();

      await promise1;
      cache.get();

      expect(getter.mock.calls.length).toBe(1);
    });

    test('executes getter again when value is stale', async () => {
      const getter = vi.fn(async () => 1);
      const cache = createPagedCache({ fetchPage: getter });

      await cache.get();
      cache.invalidate();
      cache.get();

      expect(getter.mock.calls.length).toBe(2);
    });

    test('returns one page after another when fetchNextPage is called', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length;
        },
      });

      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0],
        hasMore: true,
        pageCount: null,
      });
      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0, 1],
        hasMore: true,
        pageCount: null,
      });
      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0, 1, 2],
        hasMore: true,
        pageCount: null,
      });
    });

    test('return hasMore=false when a page returns null', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          if (pages.length >= 2) {
            return null;
          }
          return pages.length;
        },
      });

      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0],
        hasMore: true,
        pageCount: null,
      });
      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0, 1],
        hasMore: true,
        pageCount: null,
      });
      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0, 1],
        hasMore: false,
        pageCount: null,
      });
    });

    test('return hasMore=false when hasMore function returns false', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length;
        },
        hasMorePages: (pages) => pages.at(-1) !== 2,
      });

      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0],
        hasMore: true,
        pageCount: null,
      });
      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0, 1],
        hasMore: true,
        pageCount: null,
      });
      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0, 1, 2],
        hasMore: false,
        pageCount: null,
      });
    });

    test('return pageCount when getPageCount function is provided', async () => {
      const cache = createPagedCache<{ value: number; count: number }>({
        fetchPage: async ({ pages }) => {
          return { value: pages.length, count: 2 };
        },
        getPageCount: (pages) => pages[0]?.count ?? null,
      });

      await expect(cache.get()).resolves.toStrictEqual({
        pages: [{ value: 0, count: 2 }],
        hasMore: true,
        pageCount: 2,
      });

      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [
          { value: 0, count: 2 },
          { value: 1, count: 2 },
        ],
        hasMore: false,
        pageCount: 2,
      });
    });

    test('throws when fetchNextPage is called after the last page and throwOnError is true', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length === 0 ? 0 : null;
        },
      });

      await expect(cache.fetchNextPage({ throwOnError: true })).resolves.toBeUndefined();
      await expect(cache.fetchNextPage({ throwOnError: true })).resolves.toBeUndefined();
      await expect(cache.fetchNextPage({ throwOnError: true })).rejects.toThrow(
        'No more pages to fetch',
      );
    });

    test(`doesn't throw when fetchNextPage is called after the last page and throwOnError is false`, async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length === 0 ? 0 : null;
        },
      });

      await expect(cache.fetchNextPage({ throwOnError: false })).resolves.toBeUndefined();
      await expect(cache.fetchNextPage({ throwOnError: false })).resolves.toBeUndefined();
      await expect(cache.fetchNextPage({ throwOnError: false })).resolves.toBeUndefined();
    });

    test('start again from the beginning when invalidated', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length;
        },
      });

      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0],
        hasMore: true,
        pageCount: null,
      });
      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0, 1],
        hasMore: true,
        pageCount: null,
      });

      cache.invalidate();

      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0],
        hasMore: true,
        pageCount: null,
      });
    });

    test('fetchNextPage loads the first page when status is pending', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length;
        },
      });

      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0],
        hasMore: true,
        pageCount: null,
      });
    });

    test('fetchNextPage loads the first page when data is stale', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length;
        },
      });

      await cache.get();
      cache.invalidate();
      await cache.fetchNextPage();
      await expect(cache.get()).resolves.toStrictEqual({
        pages: [0],
        hasMore: true,
        pageCount: null,
      });
    });

    test('throws when fetchNextPage is called while in error state and throwOnError is true', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async () => {
          throw new Error('Failed to load page');
        },
      });

      await expect(cache.get()).rejects.toThrow('Failed to load page');
      await expect(cache.fetchNextPage({ throwOnError: true })).rejects.toThrow(
        'Cannot fetch next page while cache is in error state',
      );
    });

    test(`doesn't throw when fetchNextPage is called while in error state and throwOnError is false`, async () => {
      const cache = createPagedCache<number>({
        fetchPage: async () => {
          throw new Error('Failed to load page');
        },
      });

      await expect(cache.get()).rejects.toThrow('Failed to load page');
      await expect(cache.fetchNextPage()).resolves.toBeUndefined();
    });

    test('throws when fetchNextPage is called while update is already running and throwOnError is true', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length;
        },
      });

      cache.fetchNextPage();
      expect(cache.state.get().isUpdating).toBe(true);
      await expect(cache.fetchNextPage({ throwOnError: true })).rejects.toThrow(
        'Cannot fetch next page while another page is being fetched',
      );
    });

    test(`doesn't throw when fetchNextPage is called while update is already running and throwOnError is false`, async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length;
        },
      });

      cache.fetchNextPage();
      expect(cache.state.get().isUpdating).toBe(true);
      await expect(cache.fetchNextPage()).resolves.toBeUndefined();
    });
  });

  test('bug: return same values for different args', async () => {
    const cache = createPagedCache<string, [string]>((id) => ({
      async fetchPage({ pages }) {
        return id + pages.length;
      },
    }));

    await expect(cache('1-').get()).resolves.toStrictEqual({
      pages: ['1-0'],
      hasMore: true,
      pageCount: null,
    });

    await expect(cache('2-').get()).resolves.toStrictEqual({
      pages: ['2-0'],
      hasMore: true,
      pageCount: null,
    });
  });
});
