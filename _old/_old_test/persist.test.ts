import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { atomicStore } from '../src';
import { immerActions } from '../src/integrations/immer';
import type { PersistStorage } from '../_old_src/persist';
import { persist } from '../_old_src/persist';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mockStorage = (impl: Partial<PersistStorage> = {}): PersistStorage => ({
  keys: () => [],
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  ...impl,
});

describe('persist', () => {
  describe('save', () => {
    test('success', async () => {
      const setItem = vi.fn();
      const storage = mockStorage({ setItem });
      const store = atomicStore({ a: 1 });
      const { allSaved } = persist(store, storage, { id: 'store' });

      await allSaved();

      expect(setItem.mock.calls).toEqual([['store', `{"a":1}`]]);
    });

    test('throttled', async () => {
      const setItem = vi.fn();
      const storage = mockStorage({ setItem });
      const store = atomicStore({ a: 1 });
      const { hydrated, allSaved } = persist(store, storage, { id: 'store', throttle: 3 });

      await hydrated;

      vi.advanceTimersByTime(1);
      store.update({ a: 2 });

      vi.advanceTimersByTime(1);
      store.update({ a: 3 });

      vi.advanceTimersByTime(1);
      await allSaved();

      expect(setItem.mock.calls).toEqual([
        //
        ['store', `{"a":1}`],
        ['store', `{"a":3}`],
      ]);
    });

    test('throttled with path', async () => {
      const setItem = vi.fn();
      const storage = mockStorage({ setItem });
      const store = atomicStore({ a: 1 });
      const { hydrated, allSaved } = persist(store, storage, {
        id: 'store',
        throttle: 3,
        paths: ['a'],
      });

      await hydrated;

      vi.advanceTimersByTime(1);
      store.update({ a: 2 });

      vi.advanceTimersByTime(1);
      store.update({ a: 3 });

      vi.advanceTimersByTime(1);
      await allSaved();

      expect(setItem.mock.calls).toEqual([
        //
        ['store_a', `1`],
        ['store_a', `3`],
      ]);
    });
  });

  describe('restore', () => {
    test('simple', async () => {
      const getItem = vi.fn(() => `{"a":1}`);
      const storage = mockStorage({
        keys: () => ['store'],
        getItem,
      });
      const store = atomicStore(undefined);
      const { hydrated } = persist(store, storage, { id: 'store' });

      await hydrated;

      expect(getItem.mock.calls).toEqual([['store']]);
      expect(store.get()).toEqual({ a: 1 });
    });

    test('undefined', async () => {
      const getItem = vi.fn(() => `undefined`);
      const storage = mockStorage({ keys: () => ['store'], getItem });
      const store = atomicStore(undefined);
      const { hydrated } = persist(store, storage, { id: 'store' });

      await hydrated;

      expect(getItem.mock.calls).toEqual([['store']]);
      expect(store.get()).toEqual(undefined);
    });

    test('wait for hydrated', async () => {
      const storage = mockStorage();
      const store = atomicStore(undefined);
      const { hydrated } = persist(store, storage, { id: 'store' });
      const resolve = vi.fn();
      hydrated.then(resolve);

      expect(resolve.mock.calls.length).toBe(0);

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(resolve.mock.calls.length).toBe(1);
    });
  });

  test('stop', async () => {
    const setItem = vi.fn();
    const storage = mockStorage({ setItem });
    const store = atomicStore({ a: 1 });
    const { stop, hydrated, allSaved } = persist(store, storage, { id: 'store' });

    await hydrated;
    stop();
    store.update({ a: 2 });
    await allSaved();

    expect(setItem.mock.calls).toEqual([['store', `{"a":1}`]]);
  });

  describe('paths', () => {
    test('paths', async () => {
      const setItem = vi.fn();
      const storage = mockStorage({
        keys: () => ['store', 'store_b', 'store_c.x', 'store_c.y'],
        getItem: (key) =>
          key === 'store'
            ? JSON.stringify({ a: 2, b1: 2, c: {} })
            : key === 'store_b'
            ? JSON.stringify([1, 2, 4])
            : key === 'store_c.x'
            ? JSON.stringify(2)
            : key === 'store_c.y'
            ? JSON.stringify(3)
            : null,
        setItem,
        removeItem: () => undefined,
      });

      const store = atomicStore({
        a: 1,
        b: [1, 2, 3],
        b1: 1,
        c: { x: 1, y: 2, z: 3 },
        z: undefined as number | undefined,
      });
      const { hydrated, allSaved } = persist(store, storage, {
        id: 'store',
        paths: ['', 'b', 'c.*'],
      });
      await hydrated;

      expect(store.get()).toEqual({ a: 2, b: [1, 2, 4], b1: 2, c: { x: 2, y: 3 } });

      store.update('z', 1);
      await allSaved();

      expect(setItem.mock.calls).toEqual([
        //
        ['store', JSON.stringify({ a: 2, b1: 2, c: {}, z: 1 })],
      ]);
    });
  });
});
