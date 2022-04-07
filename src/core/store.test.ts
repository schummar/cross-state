import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '..';
import { shallowEquals } from '../lib/equals';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('store', () => {
  test('create store', () => {
    const x = store(1);
    expect(x).toBeTruthy();
  });

  test('store.get', () => {
    const x = store(1);
    expect(x.get()).toBe(1);
  });

  test('store.set', () => {
    const x = store(1);
    x.set(2);
    expect(x.get()).toBe(2);
  });

  test('store.set as function', () => {
    const x = store(1);
    x.set((a) => a + 1);
    expect(x.get()).toBe(2);
  });

  test('store.isActive', () => {
    const x = store(1);
    expect(x.isActive).toBe(false);
    const cancel = x.subscribe(() => undefined);
    expect(x.isActive).toBe(true);
    cancel();
    expect(x.isActive).toBe(false);
  });

  describe('store.addEffect', () => {
    test('store.addEffect', () => {
      const x = store(1);
      const effect = vi.fn();
      x.addEffect(effect);
      expect(effect.mock.calls.length).toBe(0);
      x.subscribe(vi.fn());
      x.subscribe(vi.fn());
      expect(effect.mock.calls).toEqual([[]]);
    });

    test('store.addEffect resubscribed', () => {
      const x = store(1);
      const effect = vi.fn();
      x.addEffect(effect);
      const cancel = x.subscribe(vi.fn());
      cancel();
      x.subscribe(vi.fn());
      expect(effect.mock.calls).toEqual([[], []]);
    });

    test('store.addEffect cancel while on', () => {
      const x = store(1);
      const cancelFn = vi.fn();
      const effect = vi.fn(() => cancelFn);
      const cancelEffect = x.addEffect(effect);
      const cancel = x.subscribe(vi.fn());
      cancelEffect();
      expect(cancelFn.mock.calls).toEqual([[]]);
      cancel();
      x.subscribe(vi.fn());
      expect(effect.mock.calls.length).toBe(1);
    });

    test('store.addEffect cancel while off', () => {
      const x = store(1);
      const cancelFn = vi.fn();
      const effect = vi.fn(() => cancelFn);
      const cancelEffect = x.addEffect(effect);
      const cancel = x.subscribe(vi.fn());
      cancel();
      expect(cancelFn.mock.calls).toEqual([[]]);
      cancelEffect();
      x.subscribe(vi.fn());
      expect(cancelFn.mock.calls.length).toBe(1);
      expect(effect.mock.calls.length).toBe(1);
    });
  });

  describe('store.subscribe', () => {
    test('store.subscribe', () => {
      const x = store(1);
      const listener = vi.fn();
      x.subscribe(listener);
      x.set(2);
      expect(listener.mock.calls).toEqual([[1], [2]]);
    });

    test('store.subscribe runNow=false', () => {
      const x = store(1);
      const listener = vi.fn();
      x.subscribe(listener, { runNow: false });
      x.set(2);
      expect(listener.mock.calls).toEqual([[2]]);
    });

    test('store.subscribe throttle', async () => {
      const x = store(1);
      const listener = vi.fn();
      x.subscribe(listener, { throttle: 2 });
      x.set(2);
      vi.advanceTimersByTime(1);
      x.set(3);
      expect(listener.mock.calls).toEqual([[1]]);

      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toEqual([[1], [3]]);
    });

    test('store.subscribe default equals', async () => {
      const x = store({ a: 1 });
      const listener = vi.fn();
      x.subscribe(listener);
      x.set({ a: 1 });
      expect(listener.mock.calls).toEqual([[{ a: 1 }], [{ a: 1 }]]);
    });

    test('store.subscribe shallowEquals', async () => {
      const x = store({ a: 1 });
      const listener = vi.fn();
      x.subscribe(listener, { equals: shallowEquals });
      x.set({ a: 1 });
      expect(listener.mock.calls).toEqual([[{ a: 1 }]]);
    });
  });
});
