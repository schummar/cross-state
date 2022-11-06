import { shallowEqual } from 'fast-equals';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchStore, store } from '../../src';
import { flushPromises, getValues, sleep } from '../testHelpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dynamic store', () => {
  test('create', () => {
    const state = fetchStore(async () => 1);
    expect(state).toBeInstanceOf(Function);
  });

  describe('get', () => {
    test('get pending', async () => {
      const state = fetchStore(async () => 1);
      expect(state.get()).toEqual({ status: 'pending', isStale: true });
    });

    test('get updating', async () => {
      const state = fetchStore(async () => 1);
      state.fetch();
      expect(state.get()).toEqual({ status: 'pending', isStale: true });
    });
  });

  describe('fetch', () => {
    test('fetch', async () => {
      const state = fetchStore(async () => 1);
      expect(state.fetch()).toBeInstanceOf(Promise);

      await flushPromises();
      expect(state.get()).toBe(1);
    });

    test('fetch with error', async () => {
      const state = fetchStore(async () => {
        throw Error('error');
      });

      await flushPromises();
      expect(state.get()).rejects.toThrow('error');
    });
  });

  describe('sub', () => {
    test('simple', async () => {
      const state = fetchStore(async () => 1);
      const listener = vi.fn();
      state.sub(listener);
      expect(listener.mock.calls.length).toBe(1);

      await flushPromises();

      expect(listener.mock.calls).toEqual([
        [undefined, undefined],
        [1, undefined],
      ]);
    });

    test('when the actions throws an error', async () => {
      const state = fetchStore(async () => {
        throw Error('error');
      });
      const listener = vi.fn();
      state.sub(listener);

      await flushPromises();
      expect(getValues(listener)).toEqual([
        //
        undefined,
        Error('error'),
      ]);
    });

    test('with runNow=false', async () => {
      const state = fetchStore(async () => 1);
      const listener = vi.fn();
      state.sub(listener, { runNow: false });
      expect(getValues(listener).length).toBe(0);

      await flushPromises();
      expect(getValues(listener)).toEqual([1]);
    });

    test('with throttle', async () => {
      const state = fetchStore(async () => 1);
      const listener = vi.fn();
      state.sub(listener, { throttle: 2 });
      state.setValue(2);
      vi.advanceTimersByTime(1);
      state.setValue(3);

      vi.advanceTimersByTime(1);
      expect(getValues(listener)).toEqual([undefined, 3]);
    });

    test('with default equals', async () => {
      const state = fetchStore(async () => [1]);
      const listener = vi.fn();
      state.sub(listener);
      await flushPromises();
      state.setValue([1]);

      expect(getValues(listener)).toEqual([undefined, [1], [1]]);
    });

    test('with shallowEqual', async () => {
      const state = fetchStore(async () => [1]);
      const listener = vi.fn();
      state.sub(listener, {
        equals: shallowEqual,
      });
      await flushPromises();
      state.setValue([1]);

      expect(getValues(listener)).toEqual([undefined, [1]]);
    });

    test.only('with dependencies', async () => {
      const dep1 = store(1);
      const dep2 = fetchStore(async () => {
        await sleep(1);
        return 10;
      });
      const state = fetchStore(async function () {
        console.log('calc');

        return this.use(dep1) + (await this.useFetch(dep2)) + 100;
      });
      const listener = vi.fn();
      state.sub(listener);

      vi.advanceTimersByTime(1);
      await flushPromises();

      // dep1.update(2);
      // await flushPromises();
      // dep2.setValue(20);
      // await flushPromises();

      expect(listener.mock.calls.map((x) => x[0])).toEqual([
        { status: 'pending', isStale: true },
        { status: 'pending', updating: Promise.resolve(), isStale: true },
        // { status: 'value', value: 111, isUpdating: false, isStale: false },
        // { status: 'value', value: 111, isUpdating: true, isStale: true },
        // { status: 'value', value: 112, isUpdating: false, isStale: false },
        // { status: 'value', value: 112, isUpdating: true, isStale: true },
        // { status: 'value', value: 122, isUpdating: false, isStale: false },
      ]);
    });

    test('cancel depdendencies', async () => {
      const dep1 = store(1);
      const dep2 = fetchStore(async () => {
        await sleep(1);
        return 10;
      });
      const state = fetchStore(async function () {
        return this.use(dep1) + (this.use(dep2).value ?? 0) + 100;
      });

      const cancel = state.sub(vi.fn());
      expect(dep1.isActive()).toBe(true);
      expect(dep2.isActive()).toBe(true);

      cancel();
      vi.advanceTimersByTime(100);
      expect(dep1.isActive()).toBe(false);
      expect(dep2.isActive()).toBe(false);
    });
  });
});