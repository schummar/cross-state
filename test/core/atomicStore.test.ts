import { shallowEqual } from 'fast-equals';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.skip('atomicStore', () => {
  test('create store', () => {
    const state = store(1);
    expect(state).toBeTruthy();
  });

  test('store.get', () => {
    const state = store(1);
    expect(state.get()).toBe(1);
  });

  test('store.set', () => {
    const state = store(1);
    state.update(2);
    expect(state.get()).toBe(2);
  });

  test('store.set as function', () => {
    const state = store(1);
    state.update((a) => a + 1);
    expect(state.get()).toBe(2);
  });

  test('store.isActive', () => {
    const state = store(1);
    expect(state.isActive).toBe(false);
    const cancel = state.subscribe(() => undefined);
    expect(state.isActive).toBe(true);
    cancel();
    expect(state.isActive).toBe(false);
  });

  describe('addEffect', () => {
    test('addEffect', () => {
      const state = store(1);
      const effect = vi.fn();
      state.addEffect(effect);
      expect(effect.mock.calls.length).toBe(0);
      state.subscribe(vi.fn());
      state.subscribe(vi.fn());
      expect(effect).toHaveBeenCalledWith();
    });

    test('store.addEffect resubscribed', () => {
      const state = store(1);
      const effect = vi.fn();
      state.addEffect(effect);

      const cancel = state.subscribe(vi.fn());
      cancel();
      state.subscribe(vi.fn());

      expect(effect.mock.calls).toEqual([[], []]);
    });

    test('store.addEffect cancel while on', () => {
      const state = store(1);
      const cancelFn = vi.fn();
      const effect = vi.fn(() => cancelFn);
      const cancelEffect = state.addEffect(effect);
      const cancel = state.subscribe(vi.fn());
      cancelEffect();
      expect(cancelFn.mock.calls).toEqual([[]]);
      cancel();
      state.subscribe(vi.fn());
      expect(effect.mock.calls.length).toBe(1);
    });

    test('store.addEffect cancel while off', () => {
      const state = store(1);
      const cancelFn = vi.fn();
      const effect = vi.fn(() => cancelFn);
      const cancelEffect = state.addEffect(effect);
      const cancel = state.subscribe(vi.fn());
      cancel();
      expect(cancelFn.mock.calls).toEqual([[]]);
      cancelEffect();
      state.subscribe(vi.fn());
      expect(cancelFn.mock.calls.length).toBe(1);
      expect(effect.mock.calls.length).toBe(1);
    });
  });

  describe('store.subscribe', () => {
    test('store.subscribe', () => {
      const state = store(1);
      const listener = vi.fn();
      state.subscribe(listener);
      state.update(2);
      expect(listener.mock.calls).toEqual([
        [1, undefined, { isUpdating: false, isStale: false, status: 'value', value: 1 }],
        [2, 1, { isUpdating: false, isStale: false, status: 'value', value: 2 }],
      ]);
    });

    test('store.subscribe runNow=false', () => {
      const state = store(1);
      const listener = vi.fn();
      state.subscribe(listener, { runNow: false });

      state.update(2);
      expect(listener.mock.calls).toMatchObject([[2, undefined, {}]]);
    });

    test('store.subscribe throttle', async () => {
      const state = store(1);
      const listener = vi.fn();
      state.subscribe(listener, { throttle: 2 });
      state.update(2);
      vi.advanceTimersByTime(1);
      state.update(3);
      expect(listener.mock.calls).toMatchObject([[1, undefined, {}]]);

      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toMatchObject([
        [1, undefined, {}],
        [3, 1, {}],
      ]);
    });

    test('store.subscribe default equals', async () => {
      const state = store({ a: 1 });
      const listener = vi.fn();
      state.subscribe(listener);
      state.update({ a: 1 });
      expect(listener.mock.calls).toMatchObject([
        [{ a: 1 }, undefined, {}],
        [{ a: 1 }, { a: 1 }, {}],
      ]);
    });

    test('store.subscribe shallowEqual', async () => {
      const state = store({ a: 1 });
      const listener = vi.fn();
      state.subscribe(listener, { equals: shallowEqual });
      state.update({ a: 1 });
      expect(listener.mock.calls).toMatchObject([[{ a: 1 }, undefined, {}]]);
    });

    test('catch error', async () => {
      const state = store(1);
      const nextListener = vi.fn();
      state.subscribe(() => {
        throw Error('error');
      });
      state.subscribe(nextListener);

      state.update(2);
      expect(() => vi.runAllTimers()).toThrow('error');
      expect(nextListener).toHaveBeenCalledTimes(2);
    });

    test('selector', async () => {
      const state = store({ x: 1 });
      const listener = vi.fn();
      state.subscribe((s) => s.x, listener);
      state.update({ x: 2 });
      expect(listener.mock.calls).toEqual([
        [1, undefined],
        [2, 1],
      ]);
    });

    test('selector with error', async () => {
      const state = store({ x: 1 });
      const nextListener = vi.fn();
      state.subscribe(
        () => undefined,
        () => {
          throw Error('error');
        }
      );
      state.subscribe(nextListener);

      state.update({ x: 2 });

      expect(() => vi.runAllTimers()).toThrow('error');
      expect(nextListener).toHaveBeenCalledTimes(2);
    });

    test('text selector', async () => {
      const state = store({ x: 1 });
      const listener = vi.fn();
      state.subscribe('x', listener);
      state.update({ x: 2 });
      expect(listener.mock.calls).toEqual([
        [1, undefined],
        [2, 1],
      ]);
    });
  });
});
