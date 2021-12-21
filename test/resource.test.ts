import { afterEach, expect, jest, test } from '@jest/globals';
import { createResource, globalResouceGroup, Resource } from '../src';

jest.useFakeTimers();

afterEach(() => {
  Resource.options = {};
  jest.runAllTimers();
});

test('get', async () => {
  let executed = 0;

  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);
  expect(await resource(1).get()).toBe(2);
  expect(executed).toBe(1);
});

test('get parallel', async () => {
  let executed = 0;

  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  const a = resource(1).get();
  const b = resource(1).get();
  expect(await a).toBe(2);
  expect(await b).toBe(2);
  expect(executed).toBe(1);
});

test('get error', async () => {
  const resource = createResource(async () => {
    throw Error();
  });

  await expect(resource().get()).rejects.toEqual(Error());
  await expect(resource().get()).rejects.toEqual(Error());
});

test('forceUpdate', async () => {
  let executed = 0;

  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);
  expect(await resource(1).get({ forceUpdate: true })).toBe(2);
  expect(executed).toBe(2);
});

test('forceUpdate parallel', async () => {
  let executed = 0;

  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  const a = resource(1).get({ forceUpdate: true });
  const b = resource(1).get({ forceUpdate: true });

  expect(await a).toBe(2);
  expect(await b).toBe(2);
  expect(executed).toBe(2);
});

test('dangling execution', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  const promise = resource(1).get();
  resource(1).clearCache();

  expect(await promise).toBe(2);
  expect(resource(1).getCache().value).toBe(undefined);
});

test('dangling execution error', async () => {
  const resource = createResource(async () => {
    throw Error();
  });

  const promise = resource().get();
  resource().clearCache();

  await expect(promise).rejects.toBeTruthy();
  expect(resource().getCache().error).toBe(undefined);
});

test('subscribe', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  let state;
  resource(1).subscribe((_state) => {
    state = _state;
  });

  expect(state).toEqual({ value: undefined, error: undefined, isLoading: true, stale: false });

  await resource(1).get();
  expect(state).toEqual({ value: 2, error: undefined, isLoading: false, stale: false });
});

test('subscribe error', async () => {
  const resource = createResource(async (): Promise<number> => {
    throw Error();
  });

  let state;
  resource().subscribe((_state) => {
    state = _state;
  });

  expect(state).toEqual({ value: undefined, error: undefined, isLoading: true, stale: false });

  await resource()
    .get()
    .catch(() => {
      // ignore
    });
  expect(state).toEqual({ value: undefined, error: Error(), isLoading: false, stale: false });
});

test('globalResouceGroup invalidateCacheAll', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);
  globalResouceGroup.invalidateCacheAll();
  expect(resource(1).getCache()?.stale).toBe(true);
});

test('globalResouceGroup clearCacheAll', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);
  globalResouceGroup.clearCacheAll();
  expect(resource(1).getCache().value).toBe(undefined);
});

test('getCache', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(resource(1).getCache().value).toBe(undefined);

  const promise = resource(1).get();
  expect(resource(1).getCache()).toEqual({ value: undefined, error: undefined, isLoading: true, stale: false });

  await promise;
  expect(resource(1).getCache()).toEqual({ value: 2, error: undefined, isLoading: false, stale: false });
});

test('update', async () => {
  const resource = createResource(async (x: number) => {
    return { value: x * 2 };
  });

  resource(1).update({ value: 42 });
  expect(resource(1).getCache()?.value).toEqual({ value: 42 });
});

test('update by function', async () => {
  const resource = createResource(async (x: number) => {
    return { value: x * 2 };
  });

  await resource(1).get();
  resource(1).update(({ value }) => ({ value: (value?.value ?? 0) + 1 }));
  expect(resource(1).getCache()?.value).toEqual({ value: 3 });
});

test('update with invalidation', async () => {
  const resource = createResource(async (x: number) => {
    return { value: x * 2 };
  });

  resource(1).update({ value: 42 }, true);
  expect(resource(1).getCache()?.value).toEqual({ value: 42 });

  await resource(1).get();
  expect(resource(1).getCache()?.value).toEqual({ value: 2 });
});

test('update with confirmation', async () => {
  const resource = createResource(async (x: number) => {
    return { value: x * 2 };
  });

  resource(1).update({ value: 42 }, Promise.resolve({ value: 43 }));
  expect(resource(1).getCache()?.value).toEqual({ value: 42 });

  await resource(1).get();
  expect(resource(1).getCache()?.value).toEqual({ value: 43 });
});

test('clearCache', async () => {
  const resource = createResource(async () => {
    return 1;
  });

  resource().clearCache();
  expect(resource().getCache().value).toBe(undefined);
});

test('invalidateAfter/clearAfter', async () => {
  const resource = createResource(
    async (x: number) => {
      return x;
    },
    {
      invalidateAfter: ({ value }) => {
        return value;
      },
      clearAfter: ({ value }) => {
        return value && value * 2;
      },
    }
  );

  await resource(100).get();
  expect(resource(100).getCache()).toEqual({ value: 100, error: undefined, isLoading: false, stale: false });

  jest.advanceTimersByTime(100);
  expect(resource(100).getCache()).toEqual({ value: 100, error: undefined, isLoading: false, stale: true });

  jest.advanceTimersByTime(100);
  expect(resource(100).getCache()).toEqual({ isLoading: false, stale: false });
});

test('clearAfter global', async () => {
  Resource.options = {
    invalidateAfter: 100,
    clearAfter: 200,
  };

  const resource = createResource(async () => {
    return 1;
  });

  await resource().get();
  expect(resource().getCache()).toEqual({ value: 1, error: undefined, isLoading: false, stale: false });

  jest.advanceTimersByTime(100);
  expect(resource().getCache()).toEqual({ value: 1, error: undefined, isLoading: false, stale: true });

  jest.advanceTimersByTime(100);
  expect(resource().getCache()).toEqual({ isLoading: false, stale: false });
});

test('clearCacheAll', async () => {
  let executed = 0;

  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);

  resource.clearCacheAll();
  expect(resource(1).getCache().value).toBe(undefined);

  expect(await resource(1).get()).toBe(2);
  expect(executed).toBe(2);
});

test('invalidateCache', async () => {
  let executed = 0;

  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);

  resource(1).invalidateCache();
  resource(2).invalidateCache();
  expect(resource(1).getCache()).toEqual({ value: 2, error: undefined, isLoading: false, stale: true });
  expect(resource(2).getCache()).toEqual({ isLoading: false, stale: false });

  expect(await resource(1).get()).toBe(2);
  expect(resource(1).getCache()).toEqual({
    value: 2,
    error: undefined,
    isLoading: false,
    stale: false,
  });

  expect(executed).toBe(2);
});

test('invalidateCacheAll', async () => {
  let executed = 0;

  const resource = createResource(async () => {
    return executed++;
  });

  expect(await resource().get()).toBe(0);

  resource.invalidateCacheAll();
  expect(resource().getCache()).toEqual({
    value: 0,
    error: undefined,
    isLoading: false,
    stale: true,
  });

  expect(await resource().get()).toBe(1);
  expect(resource().getCache()).toEqual({
    value: 1,
    error: undefined,
    isLoading: false,
    stale: false,
  });

  expect(executed).toBe(2);
});

test('update timer', async () => {
  const resource = createResource(
    async (x: number) => {
      return x * 2;
    },
    { invalidateAfter: 2 }
  );

  await resource(1).get();
  expect(resource(1).getCache()).toEqual({
    value: 2,
    error: undefined,
    isLoading: false,
    stale: false,
  });

  jest.advanceTimersByTime(1);
  resource(1).update(1);

  jest.advanceTimersByTime(1);
  expect(resource(1).getCache()).toEqual({
    value: 1,
    error: undefined,
    isLoading: false,
    stale: false,
  });

  jest.advanceTimersByTime(1);
  expect(resource(1).getCache()).toEqual({
    value: 1,
    error: undefined,
    isLoading: false,
    stale: true,
  });
});
