import { createResource, globalResouceGroup, Resource } from '../src';
import { sleep } from '../src/helpers/misc';

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
  jest.advanceTimersByTime(1);
  const b = resource(1).get({ forceUpdate: true });
  jest.advanceTimersByTime(2);

  expect(await a).toBe(2);
  expect(await b).toBe(2);
  expect(executed).toBe(2);
});

test('retry', async () => {
  let executed = 0;

  const resource = createResource(async (x: number) => {
    if (executed++ === 0) throw Error();
    return x * 2;
  });

  const promise = resource(1).get({ retries: 1 });
  await Promise.resolve();
  jest.runAllTimers();
  expect(await promise).toBe(2);
  expect(executed).toBe(2);
});

test('dangling execution', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  const promise = resource(1).get();
  resource(1).clearCache();

  expect(await promise).toBe(2);
  expect(resource(1).getCache()).toBe(undefined);
});

test('dangling execution error', async () => {
  const resource = createResource(async () => {
    throw Error();
  });

  const promise = resource().get();
  resource().clearCache();

  await expect(promise).rejects.toBeTruthy();
  expect(resource().getCache()).toBe(undefined);
});

test('subscribe', async () => {
  const resource = createResource(async (x: number) => {
    await sleep(1);
    return x * 2;
  });

  expect.assertions(2);

  let state;
  resource(1).subscribe((_state) => {
    state = _state;
  });

  jest.runAllTimers();
  expect(state).toEqual({ value: undefined, error: undefined, isLoading: true, stale: false });

  await resource(1).get();
  jest.runAllTimers();
  expect(state).toEqual({ value: 2, error: undefined, isLoading: false, stale: false });
});

test('subscribe error', async () => {
  const resource = createResource(async (): Promise<number> => {
    throw Error();
  });

  expect.assertions(2);

  let state;
  resource().subscribe((_state) => {
    state = _state;
  });

  jest.runAllTimers();
  expect(state).toEqual({ value: undefined, error: undefined, isLoading: true, stale: false });

  await resource()
    .get()
    .catch(() => {
      // ignore
    });
  jest.runAllTimers();
  expect(state).toEqual({ value: undefined, error: Error(), isLoading: false, stale: false });
});

test('globalResouceGroup invalidateCacheAll', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);
  globalResouceGroup.invalidateCacheAll();
  expect(await resource(1).getCache()?.stale).toBe(true);
});

test('globalResouceGroup clearCacheAll', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);
  globalResouceGroup.clearCacheAll();
  expect(await resource(1).getCache()).toBe(undefined);
});

test('getCache', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(resource(1).getCache()).toBe(undefined);

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
  let executed = 0;

  const resource = createResource(
    async (x: number) => {
      executed++;
      return x * 2;
    },
    { invalidateAfter: 1000 }
  );

  expect(await resource(1).get()).toBe(2);

  resource(1).clearCache();
  resource(2).clearCache();
  expect(resource(1).getCache()).toBe(undefined);
  expect(resource(2).getCache()).toBe(undefined);

  expect(await resource(1).get()).toBe(2);
  expect(executed).toBe(2);
});

test('clearCache function', async () => {
  let executed = 0;

  const resource = createResource(
    async (x: number) => {
      executed++;
      if (x === 1) return 1;
      else throw Error('error');
    },
    {
      invalidateAfter: ({ value, error }) => {
        if (executed === 1) expect(value).toBe(1);
        else expect(error).toBeTruthy();
        return 1000;
      },
    }
  );

  expect(await resource(1).get()).toBe(1);

  resource(1).clearCache();
  resource(2).clearCache();
  expect(resource(1).getCache()).toBe(undefined);
  expect(resource(2).getCache()).toBe(undefined);

  await expect(resource(2).get()).rejects.toBeTruthy();
  expect(executed).toBe(2);
});

test('clearAfter', async () => {
  const resource = createResource(
    async () => {
      return 1;
    },
    {
      invalidateAfter: () => {
        return 100;
      },
      clearAfter: () => {
        return 200;
      },
    }
  );

  await resource().get();
  expect(resource().getCache()).toEqual({ value: 1, error: undefined, isLoading: false, stale: false });

  jest.advanceTimersByTime(100);
  expect(resource().getCache()).toEqual({ value: 1, error: undefined, isLoading: false, stale: true });

  jest.advanceTimersByTime(100);
  expect(resource().getCache()).toBe(undefined);
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
  expect(resource().getCache()).toBe(undefined);
});

test('clearCacheAll', async () => {
  let executed = 0;

  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);

  resource.clearCacheAll();
  expect(resource(1).getCache()).toBe(undefined);

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
  expect(resource(1).getCache()).toEqual({
    value: 2,
    error: undefined,
    isLoading: false,
    stale: true,
  });
  expect(resource(2).getCache()).toBe(undefined);

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
