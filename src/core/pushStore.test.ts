import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, getValues, sleep, testAsyncState } from '../lib/testHelpers';
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
      this.update(0);
    })();

    expect(s).toBeInstanceOf(Object);
  });

  test('push some messages', async () => {
    const s = pushStore<number>(function () {
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
      ]);

      ws.onmessage = this.update;
    })();

    const listener = vi.fn();
    s.subscribe(listener);
    vi.advanceTimersByTime(2);
    await flushPromises();

    expect(listener.mock.calls).toEqual([
      //
      [testAsyncState({ isPending: true })],
      [testAsyncState({ value: 1 })],
      [testAsyncState({ value: 2 })],
    ]);
  });

  test('push some messages with dependencies', async () => {
    const other = store(0);
    const s = pushStore<number>(function () {
      const ws = new FakeWebSocket([
        [this.use(other) + 1, 1],
        [this.use(other) + 2, 2],
      ]);

      ws.onmessage = this.update;
      return ws.close;
    })();

    const listener = vi.fn();
    s.subscribe(listener);
    vi.advanceTimersByTime(1);
    await flushPromises();
    other.set(10);
    vi.advanceTimersByTime(2);
    await flushPromises();

    expect(listener.mock.calls).toEqual([
      //
      [testAsyncState({ isPending: true })],
      [testAsyncState({ value: 1 })],
      [testAsyncState({ value: 1, isStale: true })],
      [testAsyncState({ value: 1, isPending: true, isStale: true })],
      [testAsyncState({ value: 11 })],
      [testAsyncState({ value: 12 })],
    ]);
  });

  test('push some async messages', async () => {
    const s = pushStore<number>(function () {
      const ws = new FakeWebSocket([
        [1, 1],
        [2, 2],
      ]);

      ws.onmessage = (n) => this.update(sleep(2 - n).then(() => n));
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

      this.update(reload());
      ws.onmessage = this.update;
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

      this.update(reload());
      setTimeout(() => this.update(reload()), 2.5);

      ws.onmessage = this.update;
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

      ws.onmessage = this.update;
      ws.onerror = this.updateError;
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

          ws.onmessage = this.update;
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

          ws.onmessage = this.update;
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
        ws.onmessage = this.update;
      })();

      const promise = s.getPromise();
      vi.advanceTimersByTime(1);
      const value = await promise;
      expect(value).toBe(1);
    });

    test('getPromise with error', async () => {
      const s = pushStore<number>(function () {
        const ws = new FakeWebSocket([[Error('error'), 1]]);
        ws.onerror = this.updateError;
      })();

      const promise = s.getPromise();
      vi.advanceTimersByTime(1);

      expect(promise).rejects.toThrow(Error('error'));
    });

    test('set', async () => {
      const s = pushStore<number>(function () {
        this.update(1);
      })();

      const listener = vi.fn();
      s.subscribe(listener);
      s.set(2);
      expect(getValues(listener)).toEqual([1, 2]);
    });

    test('setError', async () => {
      const s = pushStore<number>(function () {
        this.update(1);
      })();

      const listener = vi.fn();
      s.subscribe(listener);
      s.setError(Error('error'));
      expect(getValues(listener)).toEqual([1, Error('error')]);
    });
  });
});
