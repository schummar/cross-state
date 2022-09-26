import { shallowEqual } from 'fast-equals';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store, storeSet } from '../../src';
import { flushPromises, getValues, sleep } from '../testHelpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('store', () => {
  test('create', () => {
    const state = store(async () => 1);
    expect(state).toBeTruthy();
  });

  test('create set', () => {
    const state = storeSet(async () => 1);
    expect(state).toBeInstanceOf(Function);
  });

  describe('get', () => {
    test('Without parameters', async () => {
      const state = store(async () => 1);
      expect(state.get()).toBeInstanceOf(Promise);

      await flushPromises();
      expect(state.get()).toBe(1);
    });

    test('With parameters', async () => {
      const state = storeSet(async (n: number) => n + 1);
      state(1).subscribe(vi.fn());
      state(2).subscribe(vi.fn());

      await flushPromises();
      expect(state(1).get()).toBe(2);
      expect(state(2).get()).toBe(3);
    });
  });

  describe('subscribe', () => {
    test('without parameters', async () => {
      const state = store(async () => 1);
      const listener = vi.fn();
      state.subscribe(listener);
      expect(listener.mock.calls.length).toBe(1);

      await flushPromises();

      expect(listener.mock.calls).toEqual([
        [undefined, undefined],
        [1, undefined],
      ]);
    });

    test('with parameters', async () => {
      const state = storeSet(async (n: number) => n + 1);
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      state(1).subscribe(listener1);
      state(2).subscribe(listener2);

      await flushPromises();
      expect(getValues(listener1)).toEqual([undefined, 2]);
      expect(getValues(listener2)).toEqual([undefined, 3]);
    });

    test('when the actions throws an error', async () => {
      const state = store(async () => {
        throw Error('error');
      });
      const listener = vi.fn();
      state.subscribeStatus(listener);

      await flushPromises();
      expect(getValues(listener)).toEqual([
        //
        undefined,
        Error('error'),
      ]);
    });

    test('with runNow=false', async () => {
      const state = store(async () => 1);
      const listener = vi.fn();
      state.subscribe(listener, { runNow: false });
      expect(getValues(listener).length).toBe(0);

      await flushPromises();
      expect(getValues(listener)).toEqual([1]);
    });

    test('with throttle', async () => {
      const state = store(async () => 1);
      const listener = vi.fn();
      state.subscribe(listener, { throttle: 2 });
      state.update(2);
      vi.advanceTimersByTime(1);
      state.update(3);

      vi.advanceTimersByTime(1);
      expect(getValues(listener)).toEqual([undefined, 3]);
    });

    test('with default equals', async () => {
      const state = store(async () => [1]);
      const listener = vi.fn();
      state.subscribe(listener);
      await flushPromises();
      state.update([1]);

      expect(getValues(listener)).toEqual([undefined, [1], [1]]);
    });

    test('with shallowEqual', async () => {
      const state = store(async () => [1]);
      const listener = vi.fn();
      state.subscribe((x) => x, listener, {
        equals: shallowEqual,
      });
      await flushPromises();
      state.update([1]);

      expect(getValues(listener)).toEqual([undefined, [1]]);
    });

    test('with dependencies', async () => {
      const dep1 = store(1);
      const dep2 = store(async () => {
        await sleep(1);
        return 10;
      });
      const state = store(async function () {
        return this.use(dep1) + (await this.use(dep2)) + 100;
      });
      const listener = vi.fn();
      state.subscribeStatus(listener);

      vi.advanceTimersByTime(1);

      await flushPromises();
      dep1.update(2);
      await flushPromises();
      dep2.update(20);
      await flushPromises();

      expect(listener.mock.calls.map((x) => x[0])).toMatchObject([
        { status: 'pending', isUpdating: true, isStale: true },
        { status: 'value', value: 111, isUpdating: false, isStale: false },
        { status: 'value', value: 111, isUpdating: true, isStale: true },
        { status: 'value', value: 112, isUpdating: false, isStale: false },
        { status: 'value', value: 112, isUpdating: true, isStale: true },
        { status: 'value', value: 122, isUpdating: false, isStale: false },
      ]);
    });

    test('cancel depdendencies', async () => {
      const dep1 = store(1);
      const dep2 = store(async () => {
        await sleep(1);
        return 10;
      });
      const state = store(async function () {
        return this.use(dep1) + (await this.use(dep2)) + 100;
      });

      const cancel = state.subscribe(vi.fn());
      expect(dep1.isActive).toBe(true);
      expect(dep2.isActive).toBe(true);

      cancel();
      expect(dep1.isActive).toBe(false);
      expect(dep2.isActive).toBe(false);
    });
  });
});
