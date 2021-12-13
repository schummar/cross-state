import { Action } from '../src';
import { sleep } from '../src/helpers/misc';

jest.useFakeTimers();

afterEach(() => {
  Action.options = {};
  jest.runAllTimers();
});

test('get', async () => {
  let executed = 0;

  const action = Action.create(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await action(1).get()).toBe(2);
  expect(await action(1).get()).toBe(2);
  expect(executed).toBe(1);
});

test('get parallel', async () => {
  let executed = 0;

  const action = Action.create(async (x: number) => {
    executed++;
    return x * 2;
  });

  const a = action(1).get();
  const b = action(1).get();
  expect(await a).toBe(2);
  expect(await b).toBe(2);
  expect(executed).toBe(1);
});

test('get error', async () => {
  const action = Action.create(async () => {
    throw Error();
  });

  await expect(action().get()).rejects.toEqual(Error());
  await expect(action().get()).rejects.toEqual(Error());
});

test('execute', async () => {
  let executed = 0;

  const action = Action.create(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await action(1).execute()).toBe(2);
  expect(await action(1).execute()).toBe(2);
  expect(executed).toBe(2);
});

test('execute parallel', async () => {
  let executed = 0;

  const action = Action.create(async (x: number) => {
    executed++;
    return x * 2;
  });

  const a = action(1).execute();
  jest.advanceTimersByTime(1);
  const b = action(1).execute();
  jest.advanceTimersByTime(2);

  expect(await a).toBe(2);
  expect(await b).toBe(2);
  expect(executed).toBe(2);
});

test('retry', async () => {
  let executed = 0;

  const action = Action.create(async (x: number) => {
    if (executed++ === 0) throw Error();
    return x * 2;
  });

  const promise = action(1).get({ retries: 1 });
  await Promise.resolve();
  jest.runAllTimers();
  expect(await promise).toBe(2);
  expect(executed).toBe(2);
});

test('dangling execution', async () => {
  const action = Action.create(async (x: number) => {
    return x * 2;
  });

  const promise = action(1).execute();
  action(1).clearCache();

  expect(await promise).toBe(2);
  expect(action(1).getCache()).toBe(undefined);
});

test('dangling execution error', async () => {
  const action = Action.create(async () => {
    throw Error();
  });

  const promise = action().execute();
  action().clearCache();

  await expect(promise).rejects.toBeTruthy();
  expect(action().getCache()).toBe(undefined);
});

test('subscribe', async () => {
  const action = Action.create(async (x: number) => {
    await sleep(1);
    return x * 2;
  });

  expect.assertions(3);

  let state;
  action(1).subscribe((_state) => {
    state = _state;
  });

  const promise = action(1).execute();
  expect(state).toEqual({});

  jest.runAllTimers();
  expect(state).toEqual({ value: undefined, error: undefined, isLoading: true, stale: false });

  await promise;
  jest.runAllTimers();
  expect(state).toEqual({ value: 2, error: undefined, isLoading: false, stale: false });
});

test('subscribe error', async () => {
  const action = Action.create(async (): Promise<number> => {
    await sleep(1);
    throw Error();
  });

  expect.assertions(3);

  let state;
  action().subscribe((_state) => {
    state = _state;
  });

  const promise = action()
    .execute()
    .catch(() => {
      // ignore
    });
  expect(state).toEqual({});

  jest.runAllTimers();
  expect(state).toEqual({ value: undefined, error: undefined, isLoading: true, stale: false });

  await promise;
  jest.runAllTimers();
  expect(state).toEqual({ value: undefined, error: Error(), isLoading: false, stale: false });
});

test('static invalidateCacheAll', async () => {
  const action = Action.create(async (x: number) => {
    return x * 2;
  });

  expect(await action(1).get()).toBe(2);
  Action.invalidateCacheAll();
  expect(await action(1).getCache()?.stale).toBe(true);
});

test('static clearCacheAll', async () => {
  const action = Action.create(async (x: number) => {
    return x * 2;
  });

  expect(await action(1).get()).toBe(2);
  Action.clearCacheAll();
  expect(await action(1).getCache()).toBe(undefined);
});

test('getCache', async () => {
  const action = Action.create(async (x: number) => {
    return x * 2;
  });

  expect(action(1).getCache()).toBe(undefined);

  const promise = action(1).execute();
  expect(action(1).getCache()).toEqual({ value: undefined, error: undefined, isLoading: true, stale: false });

  await promise;
  expect(action(1).getCache()).toEqual({ value: 2, error: undefined, isLoading: false, stale: false });
});

test('update', async () => {
  const action = Action.create(async (x: number) => {
    return { value: x * 2 };
  });

  action(1).update({ value: 42 });
  expect(action(1).getCache()?.value).toEqual({ value: 42 });
});

test('update by function', async () => {
  const action = Action.create(async (x: number) => {
    return { value: x * 2 };
  });

  await action(1).get();
  action(1).update(({ value }) => ({ value: (value?.value ?? 0) + 1 }));
  expect(action(1).getCache()?.value).toEqual({ value: 3 });
});

test('update with invalidation', async () => {
  const action = Action.create(async (x: number) => {
    return { value: x * 2 };
  });

  action(1).update({ value: 42 }, true);
  expect(action(1).getCache()?.value).toEqual({ value: 42 });

  await action(1).get();
  expect(action(1).getCache()?.value).toEqual({ value: 2 });
});

test('update with confirmation', async () => {
  const action = Action.create(async (x: number) => {
    return { value: x * 2 };
  });

  action(1).update({ value: 42 }, Promise.resolve({ value: 43 }));
  expect(action(1).getCache()?.value).toEqual({ value: 42 });

  await action(1).get();
  expect(action(1).getCache()?.value).toEqual({ value: 43 });
});

test('clearCache', async () => {
  let executed = 0;

  const action = Action.create(
    async (x: number) => {
      executed++;
      return x * 2;
    },
    { invalidateAfter: 1000 }
  );

  expect(await action(1).get()).toBe(2);

  action(1).clearCache();
  action(2).clearCache();
  expect(action(1).getCache()).toBe(undefined);
  expect(action(2).getCache()).toBe(undefined);

  expect(await action(1).get()).toBe(2);
  expect(executed).toBe(2);
});

test('clearCache function', async () => {
  let executed = 0;

  const action = Action.create(
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

  expect(await action(1).get()).toBe(1);

  action(1).clearCache();
  action(2).clearCache();
  expect(action(1).getCache()).toBe(undefined);
  expect(action(2).getCache()).toBe(undefined);

  await expect(action(2).get()).rejects.toBeTruthy();
  expect(executed).toBe(2);
});

test('clearAfter', async () => {
  const action = Action.create(
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

  await action().get();
  expect(action().getCache()).toEqual({ value: 1, error: undefined, isLoading: false, stale: false });

  jest.advanceTimersByTime(100);
  expect(action().getCache()).toEqual({ value: 1, error: undefined, isLoading: false, stale: true });

  jest.advanceTimersByTime(100);
  expect(action().getCache()).toBe(undefined);
});

test('clearAfter global', async () => {
  Action.options = {
    invalidateAfter: 100,
    clearAfter: 200,
  };

  const action = Action.create(async () => {
    return 1;
  });

  await action().get();
  expect(action().getCache()).toEqual({ value: 1, error: undefined, isLoading: false, stale: false });

  jest.advanceTimersByTime(100);
  expect(action().getCache()).toEqual({ value: 1, error: undefined, isLoading: false, stale: true });

  jest.advanceTimersByTime(100);
  expect(action().getCache()).toBe(undefined);
});

test('clearCacheAll', async () => {
  let executed = 0;

  const action = Action.create(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await action(1).get()).toBe(2);

  action.clearCacheAll();
  expect(action(1).getCache()).toBe(undefined);

  expect(await action(1).get()).toBe(2);
  expect(executed).toBe(2);
});

test('invalidateCache', async () => {
  let executed = 0;

  const action = Action.create(async (x: number) => {
    executed++;
    return x * 2;
  });

  expect(await action(1).get()).toBe(2);

  action(1).invalidateCache();
  action(2).invalidateCache();
  expect(action(1).getCache()).toEqual({
    value: 2,
    error: undefined,
    isLoading: false,
    stale: true,
  });
  expect(action(2).getCache()).toBe(undefined);

  expect(await action(1).get()).toBe(2);
  expect(action(1).getCache()).toEqual({
    value: 2,
    error: undefined,
    isLoading: false,
    stale: false,
  });

  expect(executed).toBe(2);
});

test('invalidateCacheAll', async () => {
  let executed = 0;

  const action = Action.create(async () => {
    return executed++;
  });

  expect(await action().get()).toBe(0);

  action.invalidateCacheAll();
  expect(action().getCache()).toEqual({
    value: 0,
    error: undefined,
    isLoading: false,
    stale: true,
  });

  expect(await action().get()).toBe(1);
  expect(action().getCache()).toEqual({
    value: 1,
    error: undefined,
    isLoading: false,
    stale: false,
  });

  expect(executed).toBe(2);
});

test('update timer', async () => {
  const action = Action.create(
    async (x: number) => {
      return x * 2;
    },
    { invalidateAfter: 2 }
  );

  await action(1).execute();
  expect(action(1).getCache()).toEqual({
    value: 2,
    error: undefined,
    isLoading: false,
    stale: false,
  });

  jest.advanceTimersByTime(1);
  await action(1).execute();

  jest.advanceTimersByTime(1);
  expect(action(1).getCache()).toEqual({
    value: 2,
    error: undefined,
    isLoading: false,
    stale: false,
  });

  jest.advanceTimersByTime(1);
  expect(action(1).getCache()).toEqual({
    value: 2,
    error: undefined,
    isLoading: false,
    stale: true,
  });
});
