import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createResource, globalResouceGroup, Resource, ResourceGroup } from '../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.resetAllMocks();
  Resource.options = {};
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

test('get returnStale=true', async () => {
  let executed = 0;
  const resource = createResource(async () => {
    return executed++;
  });
  await resource().get();
  resource().invalidateCache();
  const value = await resource().get({ returnStale: true });

  expect(value).toBe(0);
  expect(executed).toBe(2);
  expect(resource().getCache()).toEqual({ state: 'value', value: 1, isLoading: false });
});

test('get returnStale=true updateStale=false', async () => {
  let executed = 0;
  const resource = createResource(async () => {
    return executed++;
  });
  await resource().get();
  resource().invalidateCache();
  const value = await resource().get({ returnStale: true, updateStale: false });

  expect(value).toBe(0);
  expect(executed).toBe(1);
  expect(resource().getCache()).toEqual({ state: 'value', value: 0, isLoading: false, isStale: true });
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

  expect(state).toEqual({ state: 'empty', isLoading: true });

  await resource(1).get();
  expect(state).toEqual({ state: 'value', value: 2, isLoading: false });
});

test('subscribe error', async () => {
  const resource = createResource(async (): Promise<number> => {
    throw Error();
  });

  let state;
  resource().subscribe((_state) => {
    state = _state;
  });

  expect(state).toEqual({ state: 'empty', isLoading: true });

  await resource()
    .get()
    .catch(() => {
      // ignore
    });
  expect(state).toEqual({ state: 'error', error: Error(), isLoading: false });
});

test('globalResouceGroup invalidateCacheAll', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);
  globalResouceGroup.invalidateCacheAll();
  expect(resource(1).getCache()?.isStale).toBe(true);
});

test('globalResouceGroup clearCacheAll', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(await resource(1).get()).toBe(2);
  globalResouceGroup.clearCacheAll();
  expect(resource(1).getCache().value).toBe(undefined);
});

test('custom resouceGroup clearCacheAll', async () => {
  const resourceGroup = new ResourceGroup();
  const resource = createResource(
    async (x: number) => {
      return x * 2;
    },
    { resourceGroup }
  );

  expect(await resource(1).get()).toBe(2);
  resourceGroup.clearCacheAll();
  expect(resource(1).getCache().value).toBe(undefined);
});

test('getCache', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  expect(resource(1).getCache().value).toBe(undefined);

  const promise = resource(1).get();
  expect(resource(1).getCache()).toEqual({ state: 'empty', isLoading: true });

  await promise;
  expect(resource(1).getCache()).toEqual({ state: 'value', value: 2, isLoading: false });
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
  expect(resource(100).getCache()).toEqual({ state: 'value', value: 100, isLoading: false });

  vi.advanceTimersByTime(100);
  expect(resource(100).getCache()).toEqual({ state: 'value', value: 100, isLoading: false, isStale: true });

  vi.advanceTimersByTime(100);
  expect(resource(100).getCache()).toEqual({ state: 'empty', isLoading: false });
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
  expect(resource().getCache()).toEqual({ state: 'value', value: 1, isLoading: false });

  vi.advanceTimersByTime(100);
  expect(resource().getCache()).toEqual({ state: 'value', value: 1, isLoading: false, isStale: true });

  vi.advanceTimersByTime(100);
  expect(resource().getCache()).toEqual({ state: 'empty', isLoading: false });
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
  expect(resource(1).getCache()).toEqual({ state: 'value', value: 2, isLoading: false, isStale: true });
  expect(resource(2).getCache()).toEqual({ state: 'empty', isLoading: false });

  expect(await resource(1).get()).toBe(2);
  expect(resource(1).getCache()).toEqual({ state: 'value', value: 2, isLoading: false });

  expect(executed).toBe(2);
});

test('invalidateCacheAll', async () => {
  let executed = 0;

  const resource = createResource(async () => {
    return executed++;
  });

  expect(await resource().get()).toBe(0);

  resource.invalidateCacheAll();
  expect(resource().getCache()).toEqual({ state: 'value', value: 0, isLoading: false, isStale: true });

  expect(await resource().get()).toBe(1);
  expect(resource().getCache()).toEqual({ state: 'value', value: 1, isLoading: false });

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
  expect(resource(1).getCache()).toEqual({ state: 'value', value: 2, isLoading: false });

  vi.advanceTimersByTime(1);
  resource(1).update(1);

  vi.advanceTimersByTime(1);
  expect(resource(1).getCache()).toEqual({ state: 'value', value: 1, isLoading: false });

  vi.advanceTimersByTime(1);
  expect(resource(1).getCache()).toEqual({ state: 'value', value: 1, isLoading: false, isStale: true });
});
