import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore, type CalculationActions } from '../../src/core';
import { Cache, createCache } from '../../src/core/cache';
import { flushPromises, sleep } from '../testHelpers';
import { hash } from '@lib/hash';

const originalDefaultOptions = { ...createCache.defaultOptions };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  createCache.defaultOptions = { ...originalDefaultOptions };
});

describe('cache', () => {
  test('create', () => {
    const cache = createCache(async () => 1);
    expect(cache).toBeInstanceOf(Cache);
  });

  describe('get', () => {
    test('without options', async () => {
      const cache = createCache(async () => 1);
      const promise = cache.get();

      await expect(promise).resolves.toBe(1);
    });

    test('returns the same promise', async () => {
      const cache = createCache(async () => 1);
      const promise1 = cache.get();
      const promise2 = cache.get();

      await promise1;
      const promise3 = cache.get();

      expect(promise1).toBe(promise2);
      expect(promise1).toBe(promise3);
    });

    test('executes getter only once', async () => {
      const getter = vi.fn(async () => 1);
      const cache = createCache(getter);
      const promise1 = cache.get();
      cache.get();

      await promise1;
      cache.get();

      expect(getter.mock.calls.length).toBe(1);
    });

    test('executes getter again when value is stale', async () => {
      const getter = vi.fn(async () => 1);
      const cache = createCache(getter);

      await cache.get();
      cache.invalidate();
      cache.get();

      expect(getter.mock.calls.length).toBe(2);
    });

    test('with update="whenMissing"', async () => {
      const getter = vi.fn(async () => 1);
      const cache = createCache(getter);

      await cache.get();
      cache.invalidate();
      await cache.get({ update: 'whenMissing' });

      expect(getter.mock.calls.length).toBe(1);
    });

    test('with update="force"', async () => {
      const getter = vi.fn(async () => 1);
      const cache = createCache(getter);

      await cache.get();
      cache.get({ update: 'force' });

      expect(getter.mock.calls.length).toBe(2);
    });

    test('with backgroundUpdate', async () => {
      let currentValue = 1;
      const getter = vi.fn(async () => currentValue++);
      const cache = createCache(getter);

      const promise1 = cache.get();
      await promise1;
      cache.invalidate();
      const promise2 = cache.get({ backgroundUpdate: true });

      expect(getter.mock.calls.length).toBe(2);
      expect(promise1).toBe(promise2);
    });

    test('with error', async () => {
      const cache = createCache(async () => {
        throw new Error('error');
      });

      await expect(cache.get()).rejects.toThrow('error');
    });
  });

  describe('update cache', () => {
    test('with plain value', async () => {
      const cache = createCache(async () => 1);
      cache.updateValue(2);

      expect(cache.state.get()).toStrictEqual({
        status: 'value',
        value: 2,
        isStale: false,
        isUpdating: false,
        isConnected: false,
      });
    });

    test('with promise', async () => {
      const cache = createCache(async () => 1);
      cache.updateValue(Promise.resolve(2));
      await cache.get();

      expect(cache.state.get()).toStrictEqual({
        status: 'value',
        value: 2,
        isStale: false,
        isUpdating: false,
        isConnected: false,
      });
    });

    test('with function', async () => {
      const cache = createCache(async () => 1);
      await cache.get();
      cache.updateValue((x = 0) => x + 1);
      await cache.get();

      expect(cache.state.get()).toStrictEqual({
        status: 'value',
        value: 2,
        isStale: false,
        isUpdating: false,
        isConnected: false,
      });
    });

    test('with function when cache is empty', async () => {
      const cache = createCache(async () => 1);
      cache.updateValue((x = 0) => x + 1);

      expect(cache.state.get()).toStrictEqual({
        status: 'value',
        value: 1,
        isStale: false,
        isUpdating: false,
        isConnected: false,
      });
    });

    test('subscription gets notified', async () => {
      const cache = createCache(async (_key: unknown) => 1);
      const sub = vi.fn();
      cache({ a: 'a', b: 0, c: new Date(0) }).subscribe(sub);

      cache({ a: 'a', b: 0, c: new Date(0) }).updateValue(2);

      expect(sub.mock.calls.length).toBe(2);
    });
  });

  describe('sub', () => {
    test('passive', async () => {
      const cache = createCache(async () => 1);
      const sub = vi.fn();
      cache.subscribe(sub, { passive: true });

      expect(sub.mock.calls.length).toBe(0);
    });
  });

  test('invalidate', async () => {
    let i = 1;
    const cache = createCache(async () => i++);
    const promise1 = await cache.get();
    cache.invalidate();

    expect(cache.state.get()).toStrictEqual({
      status: 'value',
      value: 1,
      isStale: true,
      isUpdating: false,
      isConnected: false,
    });

    const promise2 = cache.get();

    expect(cache.state.get()).toStrictEqual({
      status: 'value',
      value: 1,
      isStale: true,
      isUpdating: true,
      isConnected: false,
    });
    expect(promise1).not.toBe(promise2);

    await promise2;

    expect(cache.state.get()).toStrictEqual({
      status: 'value',
      value: 2,
      isStale: false,
      isUpdating: false,
      isConnected: false,
    });
  });

  test('clear', async () => {
    let i = 1;
    const cache = createCache(async () => i++);
    const promise1 = await cache.get();
    cache.clear();

    expect(cache.state.get()).toStrictEqual({
      status: 'pending',
      isStale: true,
      isUpdating: false,
      isConnected: false,
    });

    const promise2 = cache.get();

    expect(cache.state.get()).toStrictEqual({
      status: 'pending',
      isStale: true,
      isUpdating: true,
      isConnected: false,
    });
    expect(promise1).not.toBe(promise2);

    await promise2;

    expect(cache.state.get()).toStrictEqual({
      status: 'value',
      value: 2,
      isStale: false,
      isUpdating: false,
      isConnected: false,
    });
  });

  describe('invalidateAfter', async () => {
    test('triggers after the given time', async () => {
      const cache = createCache(async () => 1, { invalidateAfter: { milliseconds: 1 } });
      await cache.get();

      expect(cache.state.get().isStale).toBe(false);

      vi.advanceTimersByTime(1);

      expect(cache.state.get().isStale).toBe(true);
    });

    test('is delayed when the value is updated', async () => {
      const cache = createCache(async () => 1, { invalidateAfter: { milliseconds: 2 } });
      await cache.get();

      vi.advanceTimersByTime(1);
      cache.updateValue(2);
      await flushPromises();
      vi.advanceTimersByTime(1);

      expect(cache.state.get().isStale).toBe(false);
    });

    test('invalidation timer does not prevent garbage collection', async () => {
      vi.useRealTimers();
      assert(gc, 'gc must be exposed');

      const cache = new WeakRef(
        createCache(async () => 1, { invalidateAfter: { days: 1 }, clearUnusedAfter: null }),
      );
      await cache.deref()?.get();

      await sleep(0);
      gc();

      expect(cache.deref()).toBe(undefined);
    }, 20_000);

    test('with clearOnInvalidate', async () => {
      const cache = createCache(async () => 1, {
        invalidateAfter: { milliseconds: 1 },
        clearOnInvalidate: true,
      });
      await cache.get();

      expect(cache.state.get().value).toBe(1);

      vi.advanceTimersByTime(1);

      expect(cache.state.get().value).toBe(undefined);
    });

    test('default invalidateAfter', async () => {
      createCache.defaultOptions.invalidateAfter = { milliseconds: 1 };

      const cache = createCache(async () => 1);
      await cache.get();
      vi.advanceTimersByTime(1);

      expect(cache.state.get().isStale).toBe(true);
    });
  });

  describe('invalidateOnWindowFocus', () => {
    class MockDocument {
      listener?: () => void;

      addEventListener(_event: string, listener: () => void) {
        this.listener = listener;
      }

      removeEventListener() {
        this.listener = undefined;
      }

      dispatchEvent() {
        this.listener?.();
      }
    }

    test('triggers when the window is focused', async () => {
      const document = new MockDocument();
      vi.stubGlobal('document', document);

      const cache = createCache(async () => 1, { invalidateOnWindowFocus: true });
      await cache.get();

      expect(cache.state.get().isStale).toBe(false);

      document.dispatchEvent();

      expect(cache.state.get().isStale).toBe(true);
    });
  });

  describe('invalidate dependencies', async () => {
    test('on invalidate', async () => {
      let x = 1;
      const cache1 = createCache(async () => x++);
      const cache2 = createCache(() => async ({ use }) => {
        return await use(cache1);
      });

      await cache2.get();
      cache2.invalidate(true);
      const value = await cache2.get();

      expect(value).toBe(2);
    });

    test('on parent invalidate', async () => {
      let x = 1;
      const cache1 = createCache(async () => x++);
      const cache2 = createCache(() => async ({ use }) => {
        return await use(cache1);
      });

      await cache2.get();
      cache1.invalidate();
      const value = await cache2.get();

      expect(value).toBe(2);
    });

    test('on clear', async () => {
      let x = 1;
      const cache1 = createCache(async () => x++);
      const cache2 = createCache(() => async ({ use }) => {
        return await use(cache1);
      });

      await cache2.get();
      cache2.clear(true);
      const value = await cache2.get();

      expect(value).toBe(2);
    });

    test('nested', async () => {
      let x = 1;
      const cache1 = createCache(async () => x++);
      const cache2 = createCache(() => async ({ use }) => {
        return await use(cache1);
      });
      const cache3 = createCache(() => async ({ use }) => {
        return await use(cache2);
      });

      await cache3.get();
      cache3.invalidate(true);
      const value = await cache3.get();

      expect(value).toBe(2);
    });

    test(`don't invalidate depdencies`, async () => {
      let x = 1;
      const cache1 = createCache(async () => x++);
      const cache2 = createCache(() => async ({ use }) => {
        return await use(cache1);
      });

      await cache2.get();
      cache2.invalidate();
      const value = await cache2.get();

      expect(value).toBe(1);
    });
  });

  describe('dependencies', () => {
    test('x', async () => {
      const cache1 = createCache(async () => 1);
      const cache2 = createCache(() => async ({ use }) => {
        return (await use(cache1)) + 1;
      });

      expect(await cache2.get()).toStrictEqual(2);
    });
  });

  describe('mapValue', () => {
    test('simple', async () => {
      const cache = createCache(async () => 1);
      const mapped = cache.mapValue((x) => x + 1);
      const value = await mapped.get();

      expect(value).toBe(2);
    });

    test('state of mapped value', async () => {
      const cache = createCache(async () => 1);
      const mapped = cache.mapValue((x) => x + 1);
      const value = await mapped.get();

      expect(mapped.state.get()).toStrictEqual({
        status: 'value',
        value,
        isStale: false,
        isUpdating: false,
        isConnected: false,
      });
    });

    test('mapValue throws', async () => {
      const cache = createCache(async () => 1);
      const mapped = cache.mapValue(() => {
        throw new Error('mapValue throws');
      });

      await expect(() => mapped.get()).rejects.toThrow('mapValue throws');
    });
  });

  describe('mapCache', () => {
    test('no args', async () => {
      const cache = createCache(async () => 1);
      const mapped = cache.mapCache((x) => x + 1);
      const value = await mapped.get();

      expect(value).toBe(2);
    });

    test('with args', async () => {
      const cache = createCache(async (x: number) => x);
      const mapped = cache.mapCache((x) => x + 1);
      const value = await mapped(1).get();

      expect(value).toBe(2);
    });

    test('parent changes', async () => {
      let x = 1;
      const cache = createCache(async () => x++);
      const mapped = cache.mapCache((x) => x + 1);
      const value1 = await mapped.get();

      expect(value1).toBe(2);

      cache.invalidate();
      const value2 = await mapped.get();

      expect(value2).toBe(3);
    });

    test('is invalidated without recursive', async () => {
      let x = 1;
      const cache = createCache(async () => x++);
      const mapped = cache.mapCache((x) => x + 1);
      await mapped.get();

      mapped.invalidate();
      const value = await mapped.get();

      expect(value).toBe(2);
    });

    test('is invalidated with recursive', async () => {
      let x = 1;
      const cache = createCache(async () => x++);
      const mapped = cache.mapCache((x) => x + 1);
      await mapped.get();

      mapped.invalidate(true);
      const value = await mapped.get();

      expect(value).toBe(3);
    });
  });

  describe('args', () => {
    test('no args', async () => {
      const cache = createCache(async () => 1);
      const value = await cache.get();
      expect(value).toBe(1);
    });

    test('single arg', async () => {
      const cache = createCache(async (x: number) => x);
      const value = await cache(1).get();
      expect(value).toBe(1);
    });

    test('multiple args', async () => {
      const cache = createCache(async (x: number, y: number) => x + y);
      const value = await cache(1, 2).get();
      expect(value).toBe(3);
    });

    test('optional arg', async () => {
      const cache = createCache(async (x?: number) => x ?? 1);
      const value1 = await cache.get();
      const value2 = await cache(2).get();
      expect(value1).toBe(1);
      expect(value2).toBe(2);
    });

    test('rest args', async () => {
      const cache = createCache(async (...args: number[]) => args.reduce((a, b) => a + b, 0));
      const value1 = await cache.get();
      const value2 = await cache(1, 2, 3).get();

      expect(value1).toBe(0);
      expect(value2).toBe(6);
    });

    test('same instance when called with same args', async () => {
      const cache = createCache(async (x: number) => x);
      expect(cache(1)).toBe(cache(1));
    });

    test('same instance for when not calling as when calling without args', async () => {
      const cache = createCache(async () => 1);
      expect(cache).toBe(cache());
    });

    test('same instance for when called with only undefined args', async () => {
      const cache = createCache(async (x?: number) => x ?? 0);
      expect(cache()).toBe(cache(undefined));
      expect(cache).toBe(cache(undefined));
    });

    test('same instance for when called with trailing undefined args', async () => {
      const cache = createCache(async (x: number, y?: number) => x + (y ?? 0));
      expect(cache(1)).toBe(cache(1, undefined));
    });

    test('same instance with getCacheKey', async () => {
      const cache = createCache(
        async (filter?: { x?: number; y?: number }) => (filter?.x ?? 0) + (filter?.y ?? 0),
        {
          getCacheKey(filter?) {
            return {
              x: filter?.x ?? 0,
              y: filter?.y ?? 0,
            };
          },
        },
      );

      expect(cache).toBe(cache());
      expect(cache).toBe(cache({}));
      expect(cache).toBe(cache({ x: undefined }));
      expect(cache).toBe(cache({ x: 0 }));
      expect(cache).toBe(cache({ y: undefined }));
      expect(cache).toBe(cache({ y: 0 }));
      expect(cache).toBe(cache({ x: 0, y: 0 }));
      expect(cache).not.toBe(cache({ x: 1 }));
      expect(cache({ x: 1 })).toBe(cache({ x: 1, y: undefined }));
      expect(cache({ x: 1 })).toBe(cache({ x: 1, y: 0 }));
    });

    test('customer hash function for args', async () => {
      const cache = createCache(async (x: { id: number }) => x.id);
      const arg1 = { id: 1, [hash]: () => '1' };
      const arg2 = { id: 2, [hash]: () => '1' };
      expect(cache(arg1)).toBe(cache(arg2));
    });

    test('invalidateAll', async () => {
      const cache = createCache(async (x?: number) => x);
      await cache.get();
      await cache(1).get();
      cache.invalidateAll();

      expect(cache.state.get().isStale).toBe(true);
      expect(cache(1).state.get().isStale).toBe(true);
    });

    test('invalidateAll except one', async () => {
      const cache = createCache(async (x?: number) => x);
      await cache.get();
      await cache(1).get();
      cache.invalidateAll({ filter: (x) => x !== cache() });

      expect(cache.state.get().isStale).toBe(false);
      expect(cache(1).state.get().isStale).toBe(true);
    });

    test('clearAll', async () => {
      const cache = createCache(async (x?: number) => x);
      await cache.get();
      await cache(1).get();
      cache.clearAll();

      expect(cache.state.get().value).toBe(undefined);
      expect(cache(1).state.get().value).toBe(undefined);
    });

    test('clearAll except one', async () => {
      const cache = createCache(async (x?: number) => x);
      await cache.get();
      await cache(1).get();
      cache.clearAll({ filter: (x) => x !== cache(1) });

      expect(cache.state.get().value).toBe(undefined);
      expect(cache(1).state.get().value).toBe(1);
    });

    test('getInstances', async () => {
      const cache = createCache(async (x?: number) => x);
      await cache.get();
      await cache(1).get();
      const instances = cache.getInstances();

      expect(instances).toHaveLength(2);
      expect(instances).toContain(cache);
      expect(instances).toContain(cache(1));
    });
  });

  test('bug: dependent cache updates increasingly often when cleared', async () => {
    const store = createStore({ x: 0, y: 1 });
    const calculate = vi.fn(() => async ({ use }: CalculationActions<Promise<number>>) => {
      const { x, y } = use(store);
      return x + y;
    });
    const cache = createCache(calculate);

    store.subscribe(() => {
      cache.clear();
    });
    cache.subscribe(() => undefined);

    store.set({ x: 1, y: 2 });
    await flushPromises();
    store.set({ x: 2, y: 3 });
    await flushPromises();
    store.set({ x: 3, y: 4 });
    await flushPromises();

    expect(cache.state.get().value).toBe(7);
    expect(calculate).toHaveBeenCalledTimes(7);
  });
});
