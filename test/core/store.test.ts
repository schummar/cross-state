import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore, set } from '../../src';
import { defaultEqual, shallowEqual } from '../../src/lib/equals';
import { flushPromises } from '../testHelpers';

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
      const state = createStore(1, { retain: 0 });
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
      const state = createStore(1, { retain: 0 });
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
      expect(listener.mock.calls).toMatchObject([[2, 1]]);
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

    test('store.once cancel', async () => {
      const state = createStore(0);
      const value = state.once();

      value.cancel();
      await expect(value).rejects.toThrow('cancelled');
    });

    test('store.once cancel with reason', async () => {
      const state = createStore(0);
      const value = state.once();

      value.cancel('reason');
      await expect(value).rejects.toThrow('reason');
    });

    test('store.once with signal', async () => {
      const state = createStore(0);
      const controller = new AbortController();
      const value = state.once({ signal: controller.signal });

      value.cancel();
      await expect(value).rejects.toThrow('cancelled');
    });

    test('store.once with signal and reason', async () => {
      const state = createStore(0);
      const controller = new AbortController();
      const value = state.once({ signal: controller.signal });

      value.cancel('reason');
      await expect(value).rejects.toThrow('reason');
    });

    test('store.once with timeout', async () => {
      vi.useRealTimers();

      const state = createStore(0);
      const value = state.once({ timeout: { milliseconds: 1 } });

      await expect(value).rejects.toThrow('timeout');
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

  test('reactions', () => {
    const state = createStore({ x: 1, y: 0, z: 0 });
    const reaction1 = vi.fn((x) => {
      state.set('y', x * 2);
    });
    state.map('x').subscribe(reaction1);

    const reaction2 = vi.fn((y) => {
      state.set('z', y * 2);
    });
    state.map('y').subscribe(reaction2);

    expect(state.get()).toMatchObject({ x: 1, y: 2, z: 4 });

    state.set('x', 2);
    expect(state.get()).toMatchObject({ x: 2, y: 4, z: 8 });
    expect(reaction1).toHaveBeenCalledTimes(2);
    expect(reaction2).toHaveBeenCalledTimes(2);
  });

  test('connect', async () => {
    const state = createStore(({ connect }) => {
      connect(({ set }) => {
        set(2);
        return () => undefined;
      });

      return 1;
    });

    expect(state.get()).toBe(1);

    state.subscribe(() => undefined);
    await flushPromises();

    expect(state.get()).toBe(2);
  });
});
