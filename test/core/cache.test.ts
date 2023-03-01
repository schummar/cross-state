import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { allResources, createCache, createResourceGroup, ResourceGroup } from '../../src';
import { Cache } from '../../src/core/cache';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
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
});

describe('resourceGroup', () => {
  describe('allResources', () => {
    test('invalidateAll', async () => {
      const cache = createCache(async () => 1);
      await cache.get();

      expect(cache.state.get().isStale).toBe(false);

      allResources.invalidateAll();
      expect(cache.state.get().isStale).toBe(true);
    });

    test('clearAll', async () => {
      const cache = createCache(async () => 1);
      await cache.get();

      expect(cache.state.get().value).toBe(1);

      allResources.clearAll();
      expect(cache.state.get().value).toBe(undefined);
    });
  });

  describe('custom resourceGroup', () => {
    test('create', async () => {
      const resourceGroup = createResourceGroup('test');
      expect(resourceGroup).toBeInstanceOf(ResourceGroup);
      expect(resourceGroup.name).toBe('test');
    });

    test('invalidateAll', async () => {
      const resourceGroup = createResourceGroup();
      const cache = createCache(async () => 1, { resourceGroup });
      await cache.get();

      expect(cache.state.get().isStale).toBe(false);

      resourceGroup.invalidateAll();
      expect(cache.state.get().isStale).toBe(true);
    });

    test('clearAll', async () => {
      const resourceGroup = createResourceGroup();
      const cache = createCache(async () => 1, { resourceGroup });
      await cache.get();

      expect(cache.state.get().value).toBe(1);

      resourceGroup.clearAll();
      expect(cache.state.get().value).toBe(undefined);
    });
  });
});
