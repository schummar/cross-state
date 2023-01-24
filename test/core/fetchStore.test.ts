import { shallowEqual } from 'fast-equals';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { allResources, fetchStore, ResourceGroup, store } from '../../src';
import { FetchStore } from '../../src/core/fetchStore';
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
    expect(state).toBeInstanceOf(FetchStore);
  });

  describe('get', () => {
    test('get pending', async () => {
      const state = fetchStore(async () => 1);
      expect(state.get()).toMatchObject({
        status: 'pending',
        isStale: true,
        isUpdating: false,
      });
    });

    test('get updating', async () => {
      const state = fetchStore(async () => 1);
      state.fetch();
      expect(state.get()).toMatchObject({
        status: 'pending',
        isStale: true,
        isUpdating: true,
        update: Promise.resolve(),
      });
    });
  });

  describe('fetch', () => {
    test('fetch', async () => {
      const state = fetchStore(async () => 1);
      expect(state.fetch()).toBeInstanceOf(Promise);

      await flushPromises();
      await expect(state.fetch()).resolves.toBe(1);
    });

    test('fetch with error', async () => {
      const state = fetchStore(async () => {
        throw new Error('error');
      });

      await flushPromises();
      await expect(state.fetch()).rejects.toThrow('error');
    });
  });

  describe('sub', () => {
    test('simple', async () => {
      const state = fetchStore(async () => 1);
      const listener = vi.fn();
      state.sub(listener);
      expect(listener.mock.calls.length).toBe(1);

      await flushPromises();

      expect(listener.mock.calls).toMatchObject([
        [
          {
            isStale: true,
            isUpdating: true,
            status: 'pending',
            update: Promise.resolve(),
          },
          undefined,
        ],
        [
          {
            isStale: false,
            isUpdating: false,
            status: 'value',
            value: 1,
          },
          {
            isStale: true,
            isUpdating: true,
            status: 'pending',
            update: Promise.resolve(),
          },
        ],
      ]);
    });

    test('when the actions throws an error', async () => {
      const state = fetchStore(async () => {
        throw new Error('error');
      });
      const listener = vi.fn();
      state.sub(listener);

      await flushPromises();
      expect(getValues(listener)).toEqual([
        //
        undefined,
        new Error('error'),
      ]);
    });

    test('with runNow=false', async () => {
      const state = fetchStore(async () => 1);
      const listener = vi.fn();
      state.map('value').sub(listener, { runNow: false });
      expect(getValues(listener).length).toBe(0);

      await flushPromises();
      expect(getValues(listener)).toEqual([1]);
    });

    test('with throttle', async () => {
      const state = fetchStore(async () => 1);
      const listener = vi.fn();
      state.map('value').sub(listener, { throttle: 2 });
      state.setValue(2);
      vi.advanceTimersByTime(1);
      state.setValue(3);

      vi.advanceTimersByTime(1);
      expect(getValues(listener)).toEqual([undefined, 3]);
    });

    test('with default equals', async () => {
      const state = fetchStore(async () => [1]);
      const listener = vi.fn();
      state.map('value', { disableProxy: true }).sub(listener);
      await flushPromises();
      state.setValue([1]);

      expect(getValues(listener)).toEqual([undefined, [1], [1]]);
    });

    test('with shallowEqual', async () => {
      const state = fetchStore(async () => [1]);
      const listener = vi.fn();
      state.map('value', { disableProxy: true }).sub(listener, { equals: shallowEqual });
      await flushPromises();
      state.setValue([1]);

      expect(getValues(listener)).toEqual([undefined, [1]]);
    });

    test('with dependencies', async () => {
      const dep1 = store(1);
      const dep2 = fetchStore(async () => {
        await sleep(1);
        return 10;
      });
      const state = fetchStore(async function () {
        return this.use(dep1) + (await this.useFetch(dep2)) + 100;
      });
      const listener = vi.fn();
      state.sub(listener);

      vi.advanceTimersByTime(1);
      await flushPromises();

      dep1.update(2);
      await flushPromises();

      dep2.setValue(20);
      await flushPromises();

      expect(listener.mock.calls.map((x) => x[0])).toMatchObject([
        { status: 'pending', isStale: true, isUpdating: true, update: Promise.resolve() },
        { status: 'value', value: 111, isStale: false, isUpdating: false },
        { status: 'value', value: 111, isStale: true, isUpdating: false },
        { status: 'value', value: 111, isStale: true, isUpdating: true },
        { status: 'value', value: 112, isStale: false, isUpdating: false },
        { status: 'value', value: 112, isStale: true, isUpdating: false },
        { status: 'value', value: 112, isStale: true, isUpdating: true },
        { status: 'value', value: 122, isStale: false, isUpdating: false },
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
      expect(dep1.isActive).toBe(true);
      expect(dep2.isActive).toBe(true);

      cancel();
      vi.advanceTimersByTime(100);
      expect(dep1.isActive).toBe(false);
      expect(dep2.isActive).toBe(false);
    });
  });
});

describe('resourceGroup', () => {
  describe('allResources', () => {
    test('invalidateAll', async () => {
      const state = fetchStore(async () => 1);
      await state.fetch();

      expect(state.get().isStale).toBe(false);

      allResources.invalidateAll();
      expect(state.get().isStale).toBe(true);
    });

    test('clearAll', async () => {
      const state = fetchStore(async () => 1);
      await state.fetch();

      expect(state.get().value).toBe(1);

      allResources.clearAll();
      expect(state.get().value).toBe(undefined);
    });
  });

  describe('custom resourceGroup', () => {
    test('invalidateAll', async () => {
      const resourceGroup = new ResourceGroup();
      const state = fetchStore(async () => 1, { resourceGroup });
      await state.fetch();

      expect(state.get().isStale).toBe(false);

      resourceGroup.invalidateAll();
      expect(state.get().isStale).toBe(true);
    });

    test('clearAll', async () => {
      const resourceGroup = new ResourceGroup();
      const state = fetchStore(async () => 1, { resourceGroup });
      await state.fetch();

      expect(state.get().value).toBe(1);

      resourceGroup.clearAll();
      expect(state.get().value).toBe(undefined);
    });
  });
});
