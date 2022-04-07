import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { shallowEquals } from '../lib/equals';
import { asyncStore } from './asyncStore';
import { store } from './store';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const tick = Promise.resolve();

const createState = (x: any = {}) => {
  const state = {
    value: x.value,
    error: x.error,
    isPending: x.isPending ?? false,
    isStale: x.isStale ?? false,
    status: 'value' in x ? 'value' : 'error' in x ? 'error' : 'empty',
  };
  return Object.assign(Object.values(state), state);
};

describe('asyncStore', () => {
  test('create', () => {
    const testStore = asyncStore(async () => 1);
    expect(testStore).toBeInstanceOf(Function);
  });

  describe('get', () => {
    test('Without parameters', async () => {
      const testStore = asyncStore(async () => 1)();
      expect(testStore.get()).toEqual(createState());

      testStore.subscribe(vi.fn());
      expect(testStore.get()).toEqual(createState({ isPending: true }));

      await tick;
      expect(testStore.get()).toEqual(createState({ value: 1 }));
    });

    test('With parameters', async () => {
      const testStore = asyncStore(async (n: number) => n + 1);
      testStore(1).subscribe(vi.fn());
      testStore(2).subscribe(vi.fn());

      await tick;
      expect(testStore(1).get()).toEqual(createState({ value: 2 }));
      expect(testStore(2).get()).toEqual(createState({ value: 3 }));
    });
  });

  describe('subscribe', () => {
    test('without parameters', async () => {
      const testStore = asyncStore(async () => 1)();
      const listener = vi.fn();
      testStore.subscribe(listener);
      expect(listener.mock.calls.length).toBe(1);

      await tick;
      expect(listener.mock.calls).toEqual([
        //
        [createState({ isPending: true })],
        [createState({ value: 1 })],
      ]);
    });

    test('with parameters', async () => {
      const testStore = asyncStore(async (n: number) => n + 1);
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      testStore(1).subscribe(listener1);
      testStore(2).subscribe(listener2);

      await tick;
      expect(listener1.mock.calls[1]).toEqual([createState({ value: 2 })]);
      expect(listener2.mock.calls[1]).toEqual([createState({ value: 3 })]);
    });

    test('when the actions throws an error', async () => {
      const testStore = asyncStore(async () => {
        throw Error('error');
      });
      const listener = vi.fn();
      testStore().subscribe(listener);

      await tick;
      expect(listener.mock.calls).toEqual([
        //
        [createState({ isPending: true })],
        [createState({ error: Error('error') })],
      ]);
    });

    test('with runNow=false', async () => {
      const testStore = asyncStore(async () => 1);
      const listener = vi.fn();
      testStore().subscribe(listener, { runNow: false });
      expect(listener.mock.calls.length).toBe(0);

      await tick;
      expect(listener.mock.calls).toEqual([
        //
        [createState({ value: 1 })],
      ]);
    });

    test('with throttle', async () => {
      const testStore = asyncStore(async () => 1);
      const listener = vi.fn();
      testStore().subscribe(listener, { throttle: 2 });
      testStore().set(2);
      vi.advanceTimersByTime(1);
      testStore().set(3);

      vi.advanceTimersByTime(1);
      expect(listener.mock.calls).toEqual([
        //
        [createState({ isPending: true })],
        [createState({ value: 3 })],
      ]);
    });

    test('with default equals', async () => {
      const testStore = asyncStore(async () => [1]);
      const listener = vi.fn();
      testStore().subscribe(listener);
      await tick;
      testStore().set([1]);

      expect(listener.mock.calls).toEqual([
        //
        [createState({ isPending: true })],
        [createState({ value: [1] })],
        [createState({ value: [1] })],
      ]);
    });

    test('with shallowEquals', async () => {
      const testStore = asyncStore(async () => [1]);
      const listener = vi.fn();
      testStore().subscribe(listener, { equals: shallowEquals });
      await tick;
      testStore().set([1]);

      expect(listener.mock.calls).toEqual([
        //
        [createState({ isPending: true })],
        [createState({ value: [1] })],
      ]);
    });

    test('with dependencies', async () => {
      const dep1 = store(1);
      const dep2 = asyncStore(async () => 10)();
      const y = asyncStore(async (_v, get) => get(dep1) + (get(dep2).value ?? 0) + 100);
      const listener = vi.fn();
      y().subscribe(listener);
      await tick;
      await tick;
      dep1.set(2);
      await tick;
      dep2.set(20);
      await tick;

      expect(listener.mock.calls).toEqual([
        //
        [createState({ isPending: true })],
        [createState({ value: 101 })],
        [createState({ isPending: true })],
        [createState({ value: 111 })],
        [createState({ isPending: true })],
        [createState({ value: 122 })],
      ]);
    });
  });

  describe('push', () => {
    test('push', async () => {
      const testStore = asyncStore<undefined, number>(async (_v, get, register) => {
        register((set) => {
          let c = 1;
          const interval = setInterval(() => set(c++), 1);
          return () => {
            clearInterval(interval);
          };
        });

        return 0;
      });

      const listener = vi.fn();
      const cancel = testStore().subscribe(listener);

      await tick;
      vi.advanceTimersByTime(1);
      vi.advanceTimersByTime(1);
      cancel();
      vi.advanceTimersByTime(1);

      expect(listener.mock.calls).toEqual([
        //
        [createState({ isPending: true })],
        [createState({ value: 0 })],
        [createState({ value: 1 })],
        [createState({ value: 2 })],
      ]);
    });
  });
});
