import { shallowEqual } from 'fast-equals';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { asyncStore, atomicStore } from '../../src';
import { flushPromises, getValues, sleep, testAsyncState } from '../testHelpers';

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
      const store = asyncStore(async () => 1)();
      expect(store.get()).toEqual(testAsyncState());

      store.subscribe(vi.fn());
      expect(store.get()).toEqual(testAsyncState({ isPending: true }));

      await flushPromises();
      expect(store.get()).toEqual(testAsyncState({ value: 1 }));
    });

    test('With parameters', async () => {
      const store = asyncStore(async (n: number) => n + 1);
      store(1).subscribe(vi.fn());
      store(2).subscribe(vi.fn());

      await flushPromises();
      expect(store(1).get()).toEqual(testAsyncState({ value: 2 }));
      expect(store(2).get()).toEqual(testAsyncState({ value: 3 }));
    });
  });

  describe('subscribe', () => {
    test('without parameters', async () => {
      const store = asyncStore(async () => 1)();
      const listener = vi.fn();
      store.subscribe(listener);
      expect(listener.mock.calls.length).toBe(1);

      await flushPromises();
      expect(listener.mock.calls).toEqual([
        //
        [testAsyncState({ isPending: true }), undefined],
        [testAsyncState({ value: 1 }), testAsyncState({ isPending: true })],
      ]);
    });

    test('with parameters', async () => {
      const store = asyncStore(async (n: number) => n + 1);
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      store(1).subscribe(listener1);
      store(2).subscribe(listener2);

      await flushPromises();
      expect(getValues(listener1)).toEqual([undefined, 2]);
      expect(getValues(listener2)).toEqual([undefined, 3]);
    });

    test('when the actions throws an error', async () => {
      const store = asyncStore(async () => {
        throw Error('error');
      });
      const listener = vi.fn();
      store().subscribe(listener);

      await flushPromises();
      expect(listener.mock.calls).toEqual([
        //
        [testAsyncState({ isPending: true }), undefined],
        [testAsyncState({ error: Error('error') }), testAsyncState({ isPending: true })],
      ]);
    });

    test('with runNow=false', async () => {
      const store = asyncStore(async () => 1);
      const listener = vi.fn();
      store().subscribe(listener, { runNow: false });
      expect(getValues(listener).length).toBe(0);

      await flushPromises();
      expect(getValues(listener)).toEqual([1]);
    });

    test('with throttle', async () => {
      const store = asyncStore(async () => 1);
      const listener = vi.fn();
      store().subscribe(listener, { throttle: 2 });
      store().set(2);
      vi.advanceTimersByTime(1);
      store().set(3);

      vi.advanceTimersByTime(1);
      expect(getValues(listener)).toEqual([undefined, 3]);
    });

    test('with default equals', async () => {
      const store = asyncStore(async () => [1]);
      const listener = vi.fn();
      store().subscribe(listener);
      await flushPromises();
      store().set([1]);

      expect(getValues(listener)).toEqual([undefined, [1], [1]]);
    });

    test('with shallowEqual', async () => {
      const store = asyncStore(async () => [1]);
      const listener = vi.fn();
      store().subscribe(listener, { equals: shallowEqual });
      await flushPromises();
      store().set([1]);

      expect(getValues(listener)).toEqual([undefined, [1]]);
    });

    test('with dependencies', async () => {
      const dep1 = atomicStore(1);
      const dep2 = asyncStore(async () => {
        await sleep(1);
        return 10;
      })();
      const store = asyncStore(async function () {
        return this.use(dep1) + (this.use(dep2).value ?? 0) + 100;
      });
      const listener = vi.fn();
      store().subscribe(listener);
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
