import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';
import { createCache } from '../../src';
import { Cache } from '../../src/core/cache';
import { flushPromises, sleep } from '../testHelpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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
      cache.get({ update: 'whenMissing' });

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

  describe('sub', () => {
    test('passive', async () => {
      const cache = createCache(async () => 1);
      const sub = vi.fn();
      cache.sub(sub, { passive: true });

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
    });

    const promise2 = cache.get();

    expect(cache.state.get()).toStrictEqual({
      status: 'value',
      value: 1,
      isStale: true,
      isUpdating: true,
    });
    expect(promise1).not.toBe(promise2);

    await promise2;

    expect(cache.state.get()).toStrictEqual({
      status: 'value',
      value: 2,
      isStale: false,
      isUpdating: false,
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
    });

    const promise2 = cache.get();

    expect(cache.state.get()).toStrictEqual({
      status: 'pending',
      isStale: true,
      isUpdating: true,
    });
    expect(promise1).not.toBe(promise2);

    await promise2;

    expect(cache.state.get()).toStrictEqual({
      status: 'value',
      value: 2,
      isStale: false,
      isUpdating: false,
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
      cache.set(Promise.resolve(2));
      await flushPromises();
      vi.advanceTimersByTime(1);

      expect(cache.state.get().isStale).toBe(false);
    });

    test('invalidation time does to prevent garbage collection', async () => {
      vi.useRealTimers();
      assert(gc, 'gc must be exposed');

      const cache = new WeakRef(createCache(async () => 1, { invalidateAfter: { days: 1 } }));
      await cache.deref()?.get();

      await sleep(0);
      gc();

      expect(cache.deref()).toBe(undefined);
    }, 20_000);
  });

  describe('clearAfter', async () => {
    test('triggers after the given time', async () => {
      const cache = createCache(async () => 1, { clearAfter: { milliseconds: 1 } });
      await cache.get();

      expect(cache.state.get().value).toBe(1);

      vi.advanceTimersByTime(1);

      expect(cache.state.get().value).toBe(undefined);
    });

    test('is delayed when the value is updated', async () => {
      const cache = createCache(async () => 1, { clearAfter: { milliseconds: 2 } });
      await cache.get();

      vi.advanceTimersByTime(1);
      cache.set(Promise.resolve(2));
      await flushPromises();
      vi.advanceTimersByTime(1);

      expect(cache.state.get().value).toBe(2);
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
      const cache2 = createCache(async function () {
        return await this.use(cache1);
      });

      await cache2.get();
      cache2.invalidate();
      const value = await cache2.get();

      expect(value).toBe(2);
    });

    test('on clear', async () => {
      let x = 1;
      const cache1 = createCache(async () => x++);
      const cache2 = createCache(async function () {
        return await this.use(cache1);
      });

      await cache2.get();
      cache2.clear();
      const value = await cache2.get();

      expect(value).toBe(2);
    });

    test('nested', async () => {
      let x = 1;
      const cache1 = createCache(async () => x++);
      const cache2 = createCache(async function () {
        return await this.use(cache1);
      });
      const cache3 = createCache(async function () {
        return await this.use(cache2);
      });

      await cache3.get();
      cache3.invalidate();
      const value = await cache3.get();

      expect(value).toBe(2);
    });

    test(`don't invalidate depdencies`, async () => {
      let x = 1;
      const cache1 = createCache(async () => x++);
      const cache2 = createCache(async function () {
        return await this.use(cache1);
      });

      await cache2.get();
      cache2.invalidate({ invalidateDependencies: false });
      const value = await cache2.get();

      expect(value).toBe(1);
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
      });
    });
  });
});
