import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../../src';
import { flushPromises, getValues, sleep } from '../testHelpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

export class FakeWebSocket<T> {
  timers: ReturnType<typeof setTimeout>[] = [];

  constructor(plan: [T | Error, number][]) {
    for (const [v, t] of plan) {
      this.timers.push(
        setTimeout(() => {
          if (v instanceof Error) this.onerror?.(v);
          else this.onmessage?.(v);
        }, t),
      );
    }
  }

  onmessage?: (e: T) => void;

  onerror?: (e: unknown) => void;

  close = () => {
    for (const t of this.timers) {
      clearTimeout(t);
    }
  };
}

describe.skip('subscription store', () => {
  test('create', async () => {
    const s = store<number>(function () {
      this.update(0);

      return () => undefined;
    });

    expect(s).toBeInstanceOf(Object);
  });

  test('get waits for value', async () => {
    const state = store<number>(function () {
      const ws = new FakeWebSocket([[1, 1]]);

      ws.onmessage = this.update;
      return ws.close;
    });

    const value = state.get();
    expect(value).toBeInstanceOf(Promise);

    vi.advanceTimersByTime(1);

    expect(await value).toBe(1);
  });

  test('push some messages', async () => {
    const state = store<number>(function () {
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
      ]);

      ws.onmessage = this.update;
      return ws.close;
    });

    const listener = vi.fn();
    state.subscribeStatus(listener);
    vi.advanceTimersByTime(2);
    await flushPromises();

    expect(listener.mock.calls).toEqual([
      //
      [{ status: 'pending', isStale: true, isUpdating: true, ref: {} }, undefined],
      [
        { status: 'value', value: 1, isStale: false, isUpdating: false, ref: {} },
        { status: 'pending', isStale: true, isUpdating: true, ref: {} },
      ],
      [
        { status: 'value', value: 2, isStale: false, isUpdating: false, ref: {} },
        { status: 'value', value: 1, isStale: false, isUpdating: false, ref: {} },
      ],
    ]);
  });

  test('push some messages with dependencies', async () => {
    const other = store(0);
    const state = store<number>(function () {
      const ws = new FakeWebSocket([
        [this.use(other) + 1, 1],
        [this.use(other) + 2, 2],
      ]);

      ws.onmessage = this.update;
      return ws.close;
    });

    const listener = vi.fn();
    state.subscribeStatus(listener);
    vi.advanceTimersByTime(1);
    await flushPromises();
    other.update(10);
    vi.advanceTimersByTime(2);
    await flushPromises();

    expect(listener.mock.calls.map((x) => x[0])).toMatchObject([
      //
      { status: 'pending' },
      { status: 'value', value: 1 },
      { status: 'value', value: 1, isStale: true },
      { status: 'value', value: 11 },
      { status: 'value', value: 12 },
    ]);
  });

  test('push some async messages', async () => {
    const state = store<number>(function () {
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
      ]);

      ws.onmessage = (n) => this.update(sleep(2 - n).then(() => n));
      return () => undefined;
    });

    const listener = vi.fn();
    state.subscribe(listener);
    vi.advanceTimersByTime(3);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 1, 2]);
  });

  test('reload and push', async () => {
    const state = store<number>(function () {
      const reload = () => sleep(1.5).then(() => 42);
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
      ]);

      this.update(reload());
      ws.onmessage = this.update;
      return () => undefined;
    });

    const listener = vi.fn();
    state.subscribe(listener);
    vi.advanceTimersByTime(3);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 42, 1, 2]);
  });

  test('reload and push with reconnect', async () => {
    const state = store<number>(function () {
      const reload = () => sleep(1.5).then(() => 42);
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ]);

      this.update(reload());
      setTimeout(() => this.update(reload()), 2.5);

      ws.onmessage = this.update;
      return () => undefined;
    });

    const listener = vi.fn();
    state.subscribe(listener);
    vi.advanceTimersByTime(4);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 42, 1, 2, 42, 3, 4]);
  });

  test('with error', async () => {
    const state = store<number>(function () {
      const ws = new FakeWebSocket([
        [1, 1],
        [new Error('error'), 2],
        [3, 3],
      ]);

      ws.onmessage = this.update;
      ws.onerror = this.updateError;
      return () => undefined;
    });

    const listener = vi.fn();
    state.subscribeStatus(listener);
    vi.advanceTimersByTime(3);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 1, new Error('error'), 3]);
  });

  test('with error in promise', async () => {
    const state = store<number>(function () {
      this.update(Promise.reject(new Error('error')));
      return () => undefined;
    });

    const listener = vi.fn();
    state.subscribeStatus(listener);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, new Error('error')]);
  });

  describe('unsubscribe', () => {
    test('with no retention', async () => {
      const state = store<number>(
        function () {
          const ws = new FakeWebSocket([
            [1, 1],
            [2, 2],
          ]);

          ws.onmessage = this.update;
          return ws.close;
        },
        { retain: 0 },
      );

      const listener = vi.fn();
      const cancel = state.subscribe(listener);
      vi.advanceTimersByTime(1);
      await flushPromises();
      cancel();
      vi.advanceTimersByTime(1);
      await flushPromises();

      expect(getValues(listener)).toEqual([undefined, 1]);
    });

    test('with retention', async () => {
      const state = store<number>(
        function () {
          const ws = new FakeWebSocket([
            [1, 1],
            [2, 2],
            [3, 3],
          ]);

          ws.onmessage = this.update;
          return ws.close;
        },
        { retain: 1 },
      );

      const listener = vi.fn();
      const cancel = state.subscribe(listener);
      vi.advanceTimersByTime(1);
      await flushPromises();
      cancel();
      vi.advanceTimersByTime(10);
      await flushPromises();

      expect(getValues(listener)).toEqual([undefined, 1]);
      expect(state.get()).toBe(2);
    });

    test('update', async () => {
      const state = store<number>(function () {
        this.update(1);
        return () => undefined;
      });

      const listener = vi.fn();
      state.subscribe(listener);
      state.update(2);
      expect(getValues(listener)).toEqual([1, 2]);
    });

    test('setError', async () => {
      const state = store<number>(function () {
        this.update(1);
        return () => undefined;
      });

      const listener = vi.fn();
      state.subscribeStatus(listener);
      state.setError(new Error('error'));

      expect(getValues(listener)).toEqual([1, new Error('error')]);
    });
  });
});
