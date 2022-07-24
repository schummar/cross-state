import { shallowEqual } from 'fast-equals';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { atomicStore } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('atomicStore', () => {
  test('create store', () => {
    const store = atomicStore(1);
    expect(store).toBeTruthy();
  });

  test('store.get', () => {
    const store = atomicStore(1);
    expect(store.get()).toBe(1);
  });

  test('store.set', () => {
    const store = atomicStore(1);
    store.update(2);
    expect(store.get()).toBe(2);
  });

  test('store.set as function', () => {
    const x = atomicStore(1);
    x.update((a) => a + 1);
    expect(x.get()).toBe(2);
  });

  test('store.isActive', () => {
    const store = atomicStore(1);
    expect(store.isActive()).toBe(false);
    const cancel = store.subscribe(() => undefined);
    expect(store.isActive()).toBe(true);
    cancel();
    expect(store.isActive()).toBe(false);
  });

  describe('addEffect', () => {
    test('addEffect', () => {
      const store = atomicStore(1);
      const effect = vi.fn();
      store.addEffect(effect);
      expect(effect.mock.calls.length).toBe(0);
      store.subscribe(vi.fn());
      store.subscribe(vi.fn());
      expect(effect).toHaveBeenCalledWith();
    });

    test('store.addEffect resubscribed', () => {
      const store = atomicStore(1);
      const effect = vi.fn();
      store.addEffect(effect);

      const cancel = store.subscribe(vi.fn());
      cancel();
      store.subscribe(vi.fn());

      expect(effect.mock.calls).toEqual([[], []]);
    });

    test('store.addEffect cancel while on', () => {
      const store = atomicStore(1);
      const cancelFn = vi.fn();
      const effect = vi.fn(() => cancelFn);
      const cancelEffect = store.addEffect(effect);
      const cancel = store.subscribe(vi.fn());
      cancelEffect();
      expect(cancelFn.mock.calls).toEqual([[]]);
      cancel();
      store.subscribe(vi.fn());
      expect(effect.mock.calls.length).toBe(1);
    });

    test('store.addEffect cancel while off', () => {
      const store = atomicStore(1);
      const cancelFn = vi.fn();
      const effect = vi.fn(() => cancelFn);
      const cancelEffect = store.addEffect(effect);
      const cancel = store.subscribe(vi.fn());
      cancel();
      expect(cancelFn.mock.calls).toEqual([[]]);
      cancelEffect();
      store.subscribe(vi.fn());
      expect(cancelFn.mock.calls.length).toBe(1);
      expect(effect.mock.calls.length).toBe(1);
    });
  });

  describe('store.subscribe', () => {
    test('store.subscribe', () => {
      const store = atomicStore(1);
      const listener = vi.fn();
      store.subscribe(listener);
      store.update(2);
      expect(listener.mock.calls).toEqual([
        [1, undefined],
        [2, 1],
      ]);
    });

    test('store.subscribe runNow=false', () => {
      const store = atomicStore(1);
      const listener = vi.fn();
      store.subscribe(listener, { runNow: false });
      store.update(2);
      expect(listener.mock.calls).toEqual([[2, undefined]]);
    });

    test('store.subscribe throttle', async () => {
      const store = atomicStore(1);
      const listener = vi.fn();
      store.subscribe(listener, { throttle: 2 });
      store.update(2);
      vi.advanceTimersByTime(1);
      store.update(3);
      expect(listener.mock.calls).toEqual([[1, undefined]]);

      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toEqual([
        [1, undefined],
        [3, 1],
      ]);
    });

    test('store.subscribe default equals', async () => {
      const store = atomicStore({ a: 1 });
      const listener = vi.fn();
      store.subscribe(listener);
      store.update({ a: 1 });
      expect(listener.mock.calls).toEqual([
        [{ a: 1 }, undefined],
        [{ a: 1 }, { a: 1 }],
      ]);
    });

    test('store.subscribe shallowEqual', async () => {
      const store = atomicStore({ a: 1 });
      const listener = vi.fn();
      store.subscribe(listener, { equals: shallowEqual });
      store.update({ a: 1 });
      expect(listener.mock.calls).toEqual([[{ a: 1 }, undefined]]);
    });

    test('catch error', async () => {
      const store = atomicStore(1);
      const nextListener = vi.fn();
      store.subscribe(() => {
        throw Error('error');
      });
      store.subscribe(nextListener);

      store.update(2);
      expect(() => vi.runAllTimers()).toThrow('error');
      expect(nextListener).toHaveBeenCalledTimes(2);
    });

    test('selector', async () => {
      const store = atomicStore({ x: 1 });
      const listener = vi.fn();
      store.subscribe((s) => s.x, listener);
      store.update({ x: 2 });
      expect(listener.mock.calls).toEqual([
        [1, undefined],
        [2, 1],
      ]);
    });

    test('selector with error', async () => {
      const store = atomicStore({ x: 1 });
      const nextListener = vi.fn();
      store.subscribe(
        () => undefined,
        () => {
          throw Error('error');
        }
      );
      store.subscribe(nextListener);

      store.update({ x: 2 });

      expect(() => vi.runAllTimers()).toThrow('error');
      expect(nextListener).toHaveBeenCalledTimes(2);
    });

    test('text selector', async () => {
      const store = atomicStore({ x: 1 });
      const listener = vi.fn();
      store.subscribe('x', listener);
      store.update({ x: 2 });
      expect(listener.mock.calls).toEqual([
        [1, undefined],
        [2, 1],
      ]);
    });
  });
});
