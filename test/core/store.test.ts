import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src';
import { defaultEqual, shallowEqual } from '../../src/lib/equals';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('static store', () => {
  test('create store', () => {
    const state = createStore(1);
    expect(state).toBeTruthy();
  });

  test('store.get', () => {
    const state = createStore(1);
    expect(state.get()).toBe(1);
  });

  test('store.set', () => {
    const state = createStore(1);
    state.set(2);
    expect(state.get()).toBe(2);
  });

  test('store.set as function', () => {
    const state = createStore(1);
    state.set((a) => a + 1);
    expect(state.get()).toBe(2);
  });

  test('store.isActive', () => {
    const state = createStore(1);
    expect(state.isActive()).toBe(false);
    const cancel = state.subscribe(() => undefined);
    expect(state.isActive()).toBe(true);
    cancel();
    expect(state.isActive()).toBe(false);
  });

  describe('addEffect', () => {
    test('addEffect', () => {
      const state = createStore(1);
      const effect = vi.fn();
      state.addEffect(effect);
      expect(effect.mock.calls.length).toBe(0);
      state.subscribe(vi.fn());
      state.subscribe(vi.fn());
      expect(effect).toHaveBeenCalledWith();
    });

    test('store.addEffect resubscribed', () => {
      const state = createStore(1);
      const effect = vi.fn();
      state.addEffect(effect);

      const cancel = state.subscribe(vi.fn());
      cancel();
      state.subscribe(vi.fn());

      expect(effect.mock.calls).toEqual([[], []]);
    });

    test('store.addEffect cancel while on', () => {
      const state = createStore(1);
      const cancelFunction = vi.fn();
      const effect = vi.fn(() => cancelFunction);
      const cancelEffect = state.addEffect(effect);
      const cancel = state.subscribe(vi.fn());
      cancelEffect();
      expect(cancelFunction.mock.calls).toEqual([[]]);
      cancel();
      state.subscribe(vi.fn());
      expect(effect.mock.calls.length).toBe(1);
    });

    test('store.addEffect cancel while off', () => {
      const state = createStore(1);
      const cancelFunction = vi.fn();
      const effect = vi.fn(() => cancelFunction);
      const cancelEffect = state.addEffect(effect);
      const cancel = state.subscribe(vi.fn());
      cancel();
      expect(cancelFunction.mock.calls).toEqual([[]]);
      cancelEffect();
      state.subscribe(vi.fn());
      expect(cancelFunction.mock.calls.length).toBe(1);
      expect(effect.mock.calls.length).toBe(1);
    });
  });

  describe('store.subscribe', () => {
    test('store.subscribe', () => {
      const state = createStore(1);
      const listener = vi.fn();
      state.subscribe(listener);
      state.set(2);
      expect(listener.mock.calls.map((x) => x[0])).toEqual([1, 2]);
    });

    test('store.subscribe runNow=false', () => {
      const state = createStore(1);
      const listener = vi.fn();
      state.subscribe(listener, { runNow: false });

      state.set(2);
      expect(listener.mock.calls).toMatchObject([[2, undefined]]);
    });

    test('store.subscribe throttle', async () => {
      const state = createStore(1);
      const listener = vi.fn();
      state.subscribe(listener, { throttle: 2 });
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
      const state = createStore(1);
      const listener = vi.fn();
      state.subscribe(listener, { debounce: 2 });
      state.set(2);
      vi.advanceTimersByTime(1);
      state.set(3);
      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toMatchObject([]);

      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toMatchObject([[3, undefined]]);
    });

    test('store.subscribe debounce with maxWait', async () => {
      const state = createStore(1);
      const listener = vi.fn();
      state.subscribe(listener, { debounce: { wait: 2, maxWait: 2 } });
      state.set(2);
      vi.advanceTimersByTime(1);
      state.set(3);
      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toMatchObject([[3, undefined]]);
    });

    test('store.subscribe default equals', async () => {
      const state = createStore({ a: 1 });
      const listener = vi.fn();
      state.subscribe(listener, { equals: defaultEqual });
      state.set({ a: 1 });
      expect(listener.mock.calls).toMatchObject([
        [{ a: 1 }, undefined],
        [{ a: 1 }, { a: 1 }],
      ]);
    });

    test('store.subscribe shallowEqual', async () => {
      const state = createStore({ a: 1 });
      const listener = vi.fn();
      state.subscribe(listener, { equals: shallowEqual });
      state.set({ a: 1 });
      expect(listener.mock.calls).toMatchObject([[{ a: 1 }, undefined]]);
    });

    test('catch error', async () => {
      const state = createStore(1);
      const nextListener = vi.fn();
      state.subscribe(() => {
        throw new Error('error');
      });
      state.subscribe(nextListener);

      state.set(2);
      expect(() => vi.runAllTimers()).toThrow('error');

      expect(nextListener).toHaveBeenCalledTimes(2);
    });

    test('store.subscribe cancel', () => {
      const state = createStore(1);
      const listener = vi.fn();
      const cancel = state.subscribe(listener);
      cancel();
      state.set(2);
      expect(listener.mock.calls).toMatchObject([[1, undefined]]);
    });

    test('store.subscribe cancel twice', () => {
      const state = createStore(1);
      const listener = vi.fn();
      const cancel = state.subscribe(listener);
      cancel();
      cancel();
      state.set(2);
      expect(listener.mock.calls).toMatchObject([[1, undefined]]);
    });

    test('store.subscribe cancel and resubscribe', () => {
      const state = createStore(1);
      const listener = vi.fn();
      const cancel = state.subscribe(listener);
      state.set(2);
      cancel();
      state.set(3);
      state.subscribe(listener);
      state.set(4);
      expect(listener.mock.calls).toMatchObject([
        [1, undefined],
        [2, 1],
        [3, undefined],
        [4, 3],
      ]);
    });

    test('store.once without condition', async () => {
      const state = createStore(0);
      const value = state.once();

      state.set(1);
      await expect(value).resolves.toBe(1);
    });

    test('store.once with condition', async () => {
      const state = createStore(0);
      const value = state.once((x) => x > 1);

      state.set(1);
      state.set(2);
      await expect(value).resolves.toBe(2);
    });

    test('store.once with type guard', async () => {
      const state = createStore<string | number>('0');
      const value = state.once((x): x is number => typeof x === 'number');

      state.set('1');
      state.set(2);
      await expect(value).resolves.toBe(2);
    });
  });

  test('bug: subscribe fires too often for mapped store', () => {
    const state = createStore(true);
    const mapped = state.map((x) => [x]);
    const listener = vi.fn();
    mapped.subscribe(listener, { equals: defaultEqual });
    state.set(false);
    state.set(true);
    state.set(false);
    state.set(true);
    state.set(false);

    expect(listener.mock.calls.map((x) => x[0][0])).toMatchObject([
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });
});
