import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { shallowEquals } from '../lib/equals';
import { flushPromises, getValues, sleep, testAsyncState } from '../lib/testHelpers';
import { asyncStore } from './asyncStore';
import { store } from './store';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('asyncStore', () => {
  test('create', () => {
    const testStore = asyncStore(async () => 1);
    expect(testStore).toBeInstanceOf(Function);
  });

  describe('get', () => {
    test('Without parameters', async () => {
      const testStore = asyncStore(async () => 1)();
      expect(testStore.get()).toEqual(testAsyncState());

      testStore.subscribe(vi.fn());
      expect(testStore.get()).toEqual(testAsyncState({ isPending: true }));

      await flushPromises();
      expect(testStore.get()).toEqual(testAsyncState({ value: 1 }));
    });

    test('With parameters', async () => {
      const testStore = asyncStore(async (n: number) => n + 1);
      testStore(1).subscribe(vi.fn());
      testStore(2).subscribe(vi.fn());

      await flushPromises();
      expect(testStore(1).get()).toEqual(testAsyncState({ value: 2 }));
      expect(testStore(2).get()).toEqual(testAsyncState({ value: 3 }));
    });
  });

  describe('subscribe', () => {
    test('without parameters', async () => {
      const testStore = asyncStore(async () => 1)();
      const listener = vi.fn();
      testStore.subscribe(listener);
      expect(listener.mock.calls.length).toBe(1);

      await flushPromises();
      expect(listener.mock.calls).toEqual([
        //
        [testAsyncState({ isPending: true })],
        [testAsyncState({ value: 1 })],
      ]);
    });

    test('with parameters', async () => {
      const testStore = asyncStore(async (n: number) => n + 1);
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      testStore(1).subscribe(listener1);
      testStore(2).subscribe(listener2);

      await flushPromises();
      expect(getValues(listener1)).toEqual([undefined, 2]);
      expect(getValues(listener2)).toEqual([undefined, 3]);
    });

    test('when the actions throws an error', async () => {
      const testStore = asyncStore(async () => {
        throw Error('error');
      });
      const listener = vi.fn();
      testStore().subscribe(listener);

      await flushPromises();
      expect(listener.mock.calls).toEqual([
        //
        [testAsyncState({ isPending: true })],
        [testAsyncState({ error: Error('error') })],
      ]);
    });

    test('with runNow=false', async () => {
      const testStore = asyncStore(async () => 1);
      const listener = vi.fn();
      testStore().subscribe(listener, { runNow: false });
      expect(getValues(listener).length).toBe(0);

      await flushPromises();
      expect(getValues(listener)).toEqual([1]);
    });

    test('with throttle', async () => {
      const testStore = asyncStore(async () => 1);
      const listener = vi.fn();
      testStore().subscribe(listener, { throttle: 2 });
      testStore().set(2);
      vi.advanceTimersByTime(1);
      testStore().set(3);

      vi.advanceTimersByTime(1);
      expect(getValues(listener)).toEqual([undefined, 3]);
    });

    test('with default equals', async () => {
      const testStore = asyncStore(async () => [1]);
      const listener = vi.fn();
      testStore().subscribe(listener);
      await flushPromises();
      testStore().set([1]);

      expect(getValues(listener)).toEqual([undefined, [1], [1]]);
    });

    test('with shallowEquals', async () => {
      const testStore = asyncStore(async () => [1]);
      const listener = vi.fn();
      testStore().subscribe(listener, { equals: shallowEquals });
      await flushPromises();
      testStore().set([1]);

      expect(getValues(listener)).toEqual([undefined, [1]]);
    });

    test('with dependencies1', async () => {
      const dep1 = store(1);
      const dep2 = asyncStore(async () => {
        await sleep(1);
        return 10;
      })();
      const s = asyncStore(async function () {
        return this.use(dep1) + (this.use(dep2).value ?? 0) + 100;
      });
      const listener = vi.fn();
      s().subscribe(listener);
      vi.advanceTimersByTime(1);
      await flushPromises();
      dep1.set(2);
      await flushPromises();
      dep2.set(20);
      await flushPromises();

      expect(getValues(listener)).toEqual([undefined, 101, undefined, 111, undefined, 112, undefined, 122]);
    });
  });
});
