import { shallowEqual } from 'fast-equals';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('static store', () => {
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
    state.set(2);
    expect(state.get()).toBe(2);
  });

  test('store.set as function', () => {
    const state = store(1);
    state.set((a) => a + 1);
    expect(state.get()).toBe(2);
  });

  test('store.isActive', () => {
    const state = store(1);
    expect(state.isActive).toBe(false);
    const cancel = state.sub(() => undefined);
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
      state.sub(vi.fn());
      state.sub(vi.fn());
      expect(effect).toHaveBeenCalledWith();
    });

    test('store.addEffect resubscribed', () => {
      const state = store(1);
      const effect = vi.fn();
      state.addEffect(effect);

      const cancel = state.sub(vi.fn());
      cancel();
      state.sub(vi.fn());

      expect(effect.mock.calls).toEqual([[], []]);
    });

    test('store.addEffect cancel while on', () => {
      const state = store(1);
      const cancelFunction = vi.fn();
      const effect = vi.fn(() => cancelFunction);
      const cancelEffect = state.addEffect(effect);
      const cancel = state.sub(vi.fn());
      cancelEffect();
      expect(cancelFunction.mock.calls).toEqual([[]]);
      cancel();
      state.sub(vi.fn());
      expect(effect.mock.calls.length).toBe(1);
    });

    test('store.addEffect cancel while off', () => {
      const state = store(1);
      const cancelFunction = vi.fn();
      const effect = vi.fn(() => cancelFunction);
      const cancelEffect = state.addEffect(effect);
      const cancel = state.sub(vi.fn());
      cancel();
      expect(cancelFunction.mock.calls).toEqual([[]]);
      cancelEffect();
      state.sub(vi.fn());
      expect(cancelFunction.mock.calls.length).toBe(1);
      expect(effect.mock.calls.length).toBe(1);
    });
  });

  describe('store.subscribe', () => {
    test('store.subscribe', () => {
      const state = store(1);
      const listener = vi.fn();
      state.sub(listener);
      state.set(2);
      expect(listener.mock.calls.map((x) => x[0])).toEqual([1, 2]);
    });

    test('store.subscribe runNow=false', () => {
      const state = store(1);
      const listener = vi.fn();
      state.sub(listener, { runNow: false });

      state.set(2);
      expect(listener.mock.calls).toMatchObject([[2, undefined]]);
    });

    test('store.subscribe throttle', async () => {
      const state = store(1);
      const listener = vi.fn();
      state.sub(listener, { throttle: 2 });
      state.set(2);
      vi.advanceTimersByTime(1);
      state.set(3);
      expect(listener.mock.calls).toMatchObject([[1, undefined]]);

      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toMatchObject([
        [1, undefined],
        [3, 1],
      ]);
    });

    test('store.subscribe debounce', async () => {
      const state = store(1);
      const listener = vi.fn();
      state.sub(listener, { debounce: 2 });
      state.set(2);
      vi.advanceTimersByTime(1);
      state.set(3);
      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toMatchObject([]);

      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toMatchObject([[3, undefined]]);
    });

    test('store.subscribe debounce with maxWait', async () => {
      const state = store(1);
      const listener = vi.fn();
      state.sub(listener, { debounce: { wait: 2, maxWait: 2 } });
      state.set(2);
      vi.advanceTimersByTime(1);
      state.set(3);
      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toMatchObject([[3, undefined]]);
    });

    test('store.subscribe default equals', async () => {
      const state = store({ a: 1 });
      const listener = vi.fn();
      state.sub(listener);
      state.set({ a: 1 });
      expect(listener.mock.calls).toMatchObject([
        [{ a: 1 }, undefined],
        [{ a: 1 }, { a: 1 }],
      ]);
    });

    test('store.subscribe shallowEqual', async () => {
      const state = store({ a: 1 });
      const listener = vi.fn();
      state.sub(listener, { equals: shallowEqual });
      state.set({ a: 1 });
      expect(listener.mock.calls).toMatchObject([[{ a: 1 }, undefined]]);
    });

    test('catch error', async () => {
      const state = store(1);
      const nextListener = vi.fn();
      state.sub(() => {
        throw new Error('error');
      });
      state.sub(nextListener);

      state.set(2);
      expect(() => vi.runAllTimers()).toThrow('error');

      expect(nextListener).toHaveBeenCalledTimes(2);
    });

    test('store.subscribe cancel', () => {
      const state = store(1);
      const listener = vi.fn();
      const cancel = state.sub(listener);
      cancel();
      state.set(2);
      expect(listener.mock.calls).toMatchObject([[1, undefined]]);
    });

    test('store.subscribe cancel twice', () => {
      const state = store(1);
      const listener = vi.fn();
      const cancel = state.sub(listener);
      cancel();
      cancel();
      state.set(2);
      expect(listener.mock.calls).toMatchObject([[1, undefined]]);
    });

    test('store.subscribe cancel and resubscribe', () => {
      const state = store(1);
      const listener = vi.fn();
      const cancel = state.sub(listener);
      state.set(2);
      cancel();
      state.set(3);
      state.sub(listener);
      state.set(4);
      expect(listener.mock.calls).toMatchObject([
        [1, undefined],
        [2, 1],
        [3, undefined],
        [4, 3],
      ]);
    });

    test('store.once without condition', async () => {
      const state = store(0);
      const value = state.once();

      state.set(1);
      await expect(value).resolves.toBe(1);
    });

    test('store.once with condition', async () => {
      const state = store(0);
      const value = state.once((x) => x > 1);

      state.set(1);
      state.set(2);
      await expect(value).resolves.toBe(2);
    });

    test('store.once with type guard', async () => {
      const state = store<string | number>('0');
      const value = state.once((x): x is number => typeof x === 'number');

      state.set('1');
      state.set(2);
      await expect(value).resolves.toBe(2);
    });
  });
});
