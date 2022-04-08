import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, getValues, sleep } from '../lib/testHelpers';
import { createState } from './asyncStore.test';
import { pushStore } from './pushStore';
import { store } from './store';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

class FakeWebSocket<T> {
  timers: ReturnType<typeof setTimeout>[] = [];

  constructor(plan: [T | Error, number][]) {
    for (const [v, t] of plan) {
      this.timers.push(
        setTimeout(() => {
          if (v instanceof Error) this.onerror?.(v);
          else this.onmessage?.(v);
        }, t)
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

describe('pushStore', () => {
  test('create', async () => {
    const s = pushStore<number>(function () {
      this.set(0);
    })();

    expect(s).toBeInstanceOf(Object);
  });

  test('push some messages', async () => {
    const s = pushStore<number>(function () {
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
      ]);

      ws.onmessage = this.set;
    })();

    const listener = vi.fn();
    s.subscribe(listener);
    vi.advanceTimersByTime(2);
    await flushPromises();

    expect(listener.mock.calls).toEqual([
      //
      [createState()],
      [createState({ value: 1 })],
      [createState({ value: 2 })],
    ]);
  });

  test('push some messages with dependencies', async () => {
    const other = store(0);
    const s = pushStore<number>(function () {
      const ws = new FakeWebSocket([
        [this.use(other) + 1, 1],
        [this.use(other) + 2, 2],
      ]);

      ws.onmessage = this.set;
      return ws.close;
    })();

    const listener = vi.fn();
    s.subscribe(listener);
    vi.advanceTimersByTime(1);
    await flushPromises();
    other.set(10);
    vi.advanceTimersByTime(2);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 1, 11, 12]);
  });

  test('push some async messages', async () => {
    const s = pushStore<number>(function () {
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
      ]);

      ws.onmessage = (n) => this.set(sleep(2 - n).then(() => n));
    })();

    const listener = vi.fn();
    s.subscribe(listener);
    vi.advanceTimersByTime(3);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 1, 2]);
  });

  test('reload and push', async () => {
    const s = pushStore<number>(function () {
      const reload = () => sleep(1.5).then(() => 42);
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
      ]);

      this.set(reload());
      ws.onmessage = this.set;
    })();

    const listener = vi.fn();
    s.subscribe(listener);
    vi.advanceTimersByTime(3);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 42, 1, 2]);
  });

  test('reload and push with reconnect', async () => {
    const s = pushStore<number>(function () {
      const reload = () => sleep(1.5).then(() => 42);
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ]);

      this.set(reload());
      setTimeout(() => this.set(reload()), 2.5);

      ws.onmessage = this.set;
    })();

    const listener = vi.fn();
    s.subscribe(listener);
    vi.advanceTimersByTime(4);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 42, 1, 2, 42, 3, 4]);
  });

  test('with error', async () => {
    const s = pushStore<number>(function () {
      const ws = new FakeWebSocket([
        [1, 1],
        [Error('error'), 2],
        [3, 3],
      ]);

      ws.onmessage = this.set;
      ws.onerror = this.setError;
    })();

    const listener = vi.fn();
    s.subscribe(listener);
    vi.advanceTimersByTime(3);
    await flushPromises();

    expect(getValues(listener)).toEqual([undefined, 1, Error('error'), 3]);
  });

  describe('unsubscribe', () => {
    test('with no retention', async () => {
      const s = pushStore<number>(
        function () {
          const ws = new FakeWebSocket([
            [1, 1],
            [2, 2],
          ]);

          ws.onmessage = this.set;
          return ws.close;
        },
        { retain: 0 }
      )();

      const listener = vi.fn();
      const cancel = s.subscribe(listener);
      vi.advanceTimersByTime(1);
      await flushPromises();
      cancel();
      vi.advanceTimersByTime(1);
      await flushPromises();

      expect(getValues(listener)).toEqual([undefined, 1]);
    });

    test('with retention', async () => {
      const s = pushStore<number>(
        function () {
          const ws = new FakeWebSocket([
            [1, 1],
            [2, 2],
            [3, 3],
          ]);

          ws.onmessage = this.set;
          return ws.close;
        },
        { retain: 1 }
      )();

      const listener = vi.fn();
      const cancel = s.subscribe(listener);
      vi.advanceTimersByTime(1);
      await flushPromises();
      cancel();
      vi.advanceTimersByTime(10);
      await flushPromises();

      expect(getValues(listener)).toEqual([undefined, 1]);
      expect(s.get().value).toBe(2);
    });

    test('getPromise', async () => {
      const s = pushStore<number>(function () {
        const ws = new FakeWebSocket([[1, 1]]);
        ws.onmessage = this.set;
      })();

      const promise = s.getPromise();
      vi.advanceTimersByTime(1);
      const value = await promise;
      expect(value).toBe(1);
    });

    test('getPromise with error', async () => {
      const s = pushStore<number>(function () {
        const ws = new FakeWebSocket([[Error('error'), 1]]);
        ws.onerror = this.setError;
      })();

      const promise = s.getPromise();
      vi.advanceTimersByTime(1);

      expect(promise).rejects.toThrow(Error('error'));
    });

    test('set', async () => {
      const s = pushStore<number>(function () {
        this.set(1);
      })();

      const listener = vi.fn();
      s.subscribe(listener);
      s.set(2);
      expect(getValues(listener)).toEqual([1, 2]);
    });

    test('setError', async () => {
      const s = pushStore<number>(function () {
        this.set(1);
      })();

      const listener = vi.fn();
      s.subscribe(listener);
      s.setError(Error('error'));
      expect(getValues(listener)).toEqual([1, Error('error')]);
    });
  });
});
