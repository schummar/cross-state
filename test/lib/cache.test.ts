import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';
import { Cache } from '../../src/lib/cache';
import { sleep } from '../testHelpers';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Cache.prototype, 'now' as any).mockImplementation(() => Date.now());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('cache', () => {
  test('create', async () => {
    const cache = new Cache(() => ({}), 1);

    expect(cache).toBeInstanceOf(Object);
    expect(cache.stop).toBeInstanceOf(Function);
    expect(cache.get).toBeInstanceOf(Function);
    expect(cache.values).toBeInstanceOf(Function);
  });

  test('get', async () => {
    const factory = vi.fn((key: number) => ({ key }));
    const cache = new Cache(factory, 1);

    const v1 = cache.get(1);
    const v2 = cache.get(2);

    expect(v1).toEqual({ key: 1 });
    expect(v2).toEqual({ key: 2 });
  });

  describe('get cached value', () => {
    test('within timeout', async () => {
      vi.stubGlobal('WeakRef', undefined);

      const factory = vi.fn(() => ({}));
      const cache = new Cache(factory, 2);

      const first = cache.get();
      vi.advanceTimersByTime(1);
      const second = cache.get();

      expect(factory.mock.calls.length).toBe(1);
      expect(first).toEqual({});
      expect(second).toBe(first);
      expect(cache.stats()).toEqual({ count: 1, withRef: 1, withWeakRef: 0 });
    });

    test('keeping ref', async () => {
      const factory = vi.fn(() => ({}));
      const cache = new Cache(factory, 1);

      const first = cache.get();
      vi.advanceTimersByTime(1000);
      const second = cache.get();

      expect(factory.mock.calls.length).toBe(1);
      expect(first).toEqual({});
      expect(second).toBe(first);
      expect(cache.stats()).toEqual({ count: 1, withRef: 1, withWeakRef: 1 });
    });

    test('with no cacheTime', async () => {
      const factory = vi.fn(() => ({}));
      const cache = new Cache(factory);

      cache.get();
      vi.advanceTimersByTime(1000);
      cache.get();

      expect(factory.mock.calls.length).toBe(1);
    });
  });

  describe('cached value timeout', () => {
    test('when no ref is left', async () => {
      vi.useRealTimers();
      assert(gc, 'gc must be exposed');

      let count = 0;
      const factory = () => {
        count++;
        return {};
      };
      const cache = new Cache(factory, 1);
      cache.get();
      expect(count).toBe(1);
      expect(cache.stats()).toEqual({ count: 1, withRef: 1, withWeakRef: 1 });

      await sleep(100);
      expect(cache.stats()).toEqual({ count: 1, withRef: 0, withWeakRef: 1 });

      await sleep(0);
      gc();
      expect(cache.stats()).toEqual({ count: 1, withRef: 0, withWeakRef: 0 });

      await sleep(100);
      expect(cache.stats()).toEqual({ count: 0, withRef: 0, withWeakRef: 0 });

      cache.get();
      expect(count).toBe(2);
      expect(cache.stats()).toEqual({ count: 1, withRef: 1, withWeakRef: 1 });
    });

    test('without WeakRef support', async () => {
      vi.stubGlobal('WeakRef', undefined);

      const factory = vi.fn(() => ({}));
      const cache = new Cache(factory, 1);

      const first = cache.get();
      vi.advanceTimersByTime(2);

      const second = cache.get();

      expect(factory.mock.calls.length).toBe(2);
      expect(first).toEqual({});
      expect(second).not.toBe(first);
    });
  });

  test('stop', async () => {
    const factory = vi.fn(() => ({}));
    const cache = new Cache(factory, 1);

    cache.stop();
    cache.get();
    vi.advanceTimersByTime(1000);

    expect(cache.stats()).toEqual({ count: 1, withRef: 1, withWeakRef: 1 });
  });

  test('values', async () => {
    const factory = vi.fn((key: number) => ({ key }));
    const cache = new Cache(factory, 1000);

    const valuesBefore = cache.values();
    cache.get(1);
    cache.get(2);
    const valuesAfter = cache.values();

    expect(valuesBefore).toEqual([]);
    expect(valuesAfter).toEqual([{ key: 1 }, { key: 2 }]);
  });
});
