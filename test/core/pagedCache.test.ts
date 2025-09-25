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
      await expect(cache('item-').get()).resolves.toStrictEqual(['item-0']);
    });
  });

  describe('get', () => {
    test('without options', async () => {
      const cache = createPagedCache({ fetchPage: async () => 1 });
      const promise = cache.get();

      await expect(promise).resolves.toStrictEqual([1]);
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

      await expect(cache.get()).resolves.toStrictEqual([0]);
      await expect(cache.fetchNextPage()).resolves.toBe(1);
      await expect(cache.get()).resolves.toStrictEqual([0, 1]);
      await expect(cache.fetchNextPage()).resolves.toBe(2);
      await expect(cache.get()).resolves.toStrictEqual([0, 1, 2]);
    });

    test('start again from the beginning when invalidated', async () => {
      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          return pages.length;
        },
      });

      await expect(cache.get()).resolves.toStrictEqual([0]);
      await expect(cache.fetchNextPage()).resolves.toBe(1);
      await expect(cache.get()).resolves.toStrictEqual([0, 1]);

      cache.invalidate();

      await expect(cache.get()).resolves.toStrictEqual([0]);
    });
  });
});
