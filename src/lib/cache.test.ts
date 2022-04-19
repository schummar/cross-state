import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Cache } from './cache';

const weakRefMockHandles: (() => void)[] = [];

class WeakRefMock {
  constructor(private value: any) {
    weakRefMockHandles.push(() => {
      this.value = undefined;
    });
  }

  deref() {
    return this.value;
  }
}

const clearWeakRefMocks = () => {
  for (const ref of weakRefMockHandles) {
    ref();
  }
  weakRefMockHandles.length = 0;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WeakRef', WeakRefMock);
});

afterEach(() => {
  vi.resetAllMocks();
  clearWeakRefMocks();
});

describe('cache', () => {
  test('create', async () => {
    const cache = new Cache(() => ({}), 1000);

    expect(cache).toBeInstanceOf(Object);
    expect(cache.stop).toBeInstanceOf(Function);
    expect(cache.get).toBeInstanceOf(Function);
    expect(cache.values).toBeInstanceOf(Function);
  });

  test('get', async () => {
    const factory = vi.fn((key: number) => ({ key }));
    const cache = new Cache(factory, 1000);

    const v1 = cache.get(1);
    const v2 = cache.get(2);

    expect(v1).toEqual({ key: 1 });
    expect(v2).toEqual({ key: 2 });
  });

  describe('get cached value', () => {
    test('within timeout', async () => {
      const factory = vi.fn(() => ({}));
      const cache = new Cache(factory, 1000);

      const first = cache.get();
      vi.advanceTimersByTime(500);
      const second = cache.get();

      expect(factory.mock.calls.length).toBe(1);
      expect(first).toEqual({});
      expect(second).toBe(first);
    });

    test('keeping ref', async () => {
      const factory = vi.fn(() => ({}));
      const cache = new Cache(factory, 1000);

      const first = cache.get();
      vi.advanceTimersByTime(1000);
      const second = cache.get();

      expect(factory.mock.calls.length).toBe(1);
      expect(first).toEqual({});
      expect(second).toBe(first);
    });
  });

  describe('cached value timeout', () => {
    test('when no ref is left', async () => {
      const factory = vi.fn(() => ({}));
      const cache = new Cache(factory, 1000);

      cache.get();
      clearWeakRefMocks();
      vi.advanceTimersByTime(1000);
      cache.get();

      expect(factory.mock.calls.length).toBe(2);
    });

    test('without WeakRef support', async () => {
      vi.stubGlobal('WeakRef', undefined);

      const factory = vi.fn(() => ({}));
      const cache = new Cache(factory, 1000);

      const first = cache.get();
      vi.advanceTimersByTime(1000);
      const second = cache.get();

      expect(factory.mock.calls.length).toBe(2);
      expect(first).toEqual({});
      expect(second).not.toBe(first);
    });
  });

  test('stop', async () => {
    const factory = vi.fn(() => ({}));
    const cache = new Cache(factory, 1000);

    cache.stop();
    cache.get();
    vi.advanceTimersByTime(1000);
    clearWeakRefMocks();
    cache.get();

    expect(factory.mock.calls.length).toBe(1);
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
