import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../core/store';
import { persist } from './persist';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const tick = Promise.resolve();

describe('persist', () => {
  describe('save', () => {
    test('success', async () => {
      const setItem = vi.fn();
      const storage: any = {
        getItem: () => null,
        setItem,
      };

      const s = store({ a: 1 });
      persist(s, storage, { id: 'store' });
      await tick;
      expect(setItem.mock.calls).toEqual([['store', `{"a":1}`]]);
    });

    test('error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const setItem = () => {
        throw Error('error');
      };
      const storage: any = {
        getItem: () => null,
        setItem,
      };

      const s = store({ a: 1 });
      persist(s, storage, { id: 'store' });
      await tick;
      await tick;

      expect(consoleErrorSpy).toBeCalled();
    });

    test('throttled', async () => {
      const setItem = vi.fn();
      const storage: any = {
        getItem: () => null,
        setItem,
      };

      const s = store({ a: 1 });
      persist(s, storage, { id: 'store', throttle: 2 });
      vi.advanceTimersByTime(1);
      await tick;
      s.set({ a: 2 });
      vi.advanceTimersByTime(1);
      await tick;
      s.set({ a: 3 });
      vi.advanceTimersByTime(1);
      await tick;

      expect(setItem.mock.calls).toEqual([
        //
        ['store', `{"a":1}`],
        ['store', `{"a":3}`],
      ]);
    });
  });

  describe('restore', () => {
    test('simple', async () => {
      const getItem = vi.fn(() => `{"a":1}`);
      const storage: any = { getItem, setItem: () => undefined };

      const s = store(undefined);
      persist(s, storage, { id: 'store' });
      await tick;
      expect(getItem.mock.calls).toEqual([['store']]);
      expect(s.get()).toEqual({ a: 1 });
    });

    test('undefined', async () => {
      const getItem = vi.fn(() => `undefined`);
      const storage: any = { getItem, setItem: () => undefined };

      const s = store(undefined);
      persist(s, storage, { id: 'store' });
      await tick;
      expect(getItem.mock.calls).toEqual([['store']]);
      expect(s.get()).toEqual(undefined);
    });

    test('wait for hydrated', async () => {
      const storage: any = { getItem: () => null, setItem: () => undefined };
      const s = store(undefined);
      const { hydrated } = persist(s, storage, { id: 'store' });
      const resolve = vi.fn();
      hydrated.then(resolve);

      expect(resolve.mock.calls.length).toBe(0);
      await tick;
      await tick;
      expect(resolve.mock.calls.length).toBe(1);
    });

    test('error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const getItem = () => {
        throw Error('error');
      };
      const storage: any = { getItem, setItem: () => undefined };

      const s = store(undefined);
      persist(s, storage, { id: 'store' });
      await tick;
      await tick;

      expect(consoleErrorSpy).toBeCalled();
    });
  });

  test('stop', async () => {
    const setItem = vi.fn();
    const storage: any = {
      getItem: () => null,
      setItem,
    };

    const s = store({ a: 1 });
    const { stop } = persist(s, storage, { id: 'store' });
    await tick;
    stop();
    s.set({ a: 2 });
    await tick;

    expect(setItem.mock.calls).toEqual([['store', `{"a":1}`]]);
  });
});
