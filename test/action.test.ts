import test from 'ava';
import { Action } from '../src';
import { sleep } from '../src/misc';
import { wait } from './_helpers';

test('get', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    executed++;
    return x * 2;
  });

  t.is(await action.get(1), 2);
  t.is(await action.get(1), 2);
  t.is(executed, 1);
});

test('get parallel', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    executed++;
    return x * 2;
  });

  const a = action.get(1);
  const b = action.get(1);
  t.is(await a, 2);
  t.is(await b, 2);
  t.is(executed, 1);
});

test('get error', async (t) => {
  const action = new Action(async () => {
    await Promise.resolve();
    throw Error();
  });

  await t.throwsAsync(() => action.get(1));
  await t.throwsAsync(() => action.get(1));
});

test('execute', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    executed++;
    return x * 2;
  });

  t.is(await action.execute(1), 2);
  t.is(await action.execute(1), 2);
  t.is(executed, 2);
});

test('execute parallel', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await wait(10);
    executed++;
    return x * 2;
  });

  const a = action.execute(1);
  await wait(5);
  const b = action.execute(1);

  t.is(await a, 2);
  t.is(await b, 2);
  t.is(executed, 2);
});

test('clearBeforeUpdate', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    executed++;
    return x * 2;
  });

  await action.get(1);
  action.invalidateCache(1);

  const promise = action.get(1, { clearBeforeUpdate: true });
  t.is(action.getCacheValue(1), undefined);
  t.is(await promise, 2);
  t.is(action.getCacheValue(1), 2);
  t.is(executed, 2);
});

test('retry', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    if (executed++ === 0) throw Error();
    return x * 2;
  });

  t.is(await action.get(1, { retries: 1 }), 2);
  t.is(executed, 2);
});

test('dangling execution', async (t) => {
  const action = new Action(async (x: number) => {
    await Promise.resolve();
    return x * 2;
  });

  const promise = action.execute(1);
  action.clearCache(1);

  t.is(await promise, 2);
  t.is(action.getCache(1), undefined);
});

test('dangling execution error', async (t) => {
  const action = new Action(async () => {
    await Promise.resolve();
    throw Error();
  });

  const promise = action.execute(1);
  action.clearCache(1);

  await t.throwsAsync(() => promise);
  t.is(action.getCache(1), undefined);
});

test('subscribe', async (t) => {
  const action = new Action(async (x: number) => {
    await wait(10);
    return x * 2;
  });

  t.plan(4);

  let count = 0;
  action.subscribe(1, (value, info) => {
    if (count++ === 0) {
      t.is(value, undefined);
      t.deepEqual(info, { isLoading: true, error: undefined });
    } else {
      t.is(value, 2);
      t.deepEqual(info, { isLoading: false, error: undefined });
    }
  });

  await action.execute(1);
});

test('subscribe error', async (t) => {
  const action = new Action(async () => {
    await wait(10);
    throw Error();
  });

  t.plan(5);

  let count = 0;
  action.subscribe(1, (value, info) => {
    if (count++ === 0) {
      t.is(value, undefined);
      t.deepEqual(info, { isLoading: true, error: undefined });
    } else {
      t.is(value, undefined);
      t.deepEqual(info, { isLoading: false, error: Error() });
    }
  });

  await t.throwsAsync(() => action.execute(1));
});

test.serial('static clearCacheAll', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    executed++;
    return x * 2;
  });

  t.is(await action.get(1), 2);
  Action.clearCacheAll();
  t.is(await action.get(1), 2);
  t.is(executed, 2);
});

test('getCache', async (t) => {
  const action = new Action(async (x: number) => {
    await Promise.resolve();
    return x * 2;
  });

  t.is(action.getCache(1), undefined);

  const promise = action.execute(1);
  t.is(action.getCache(1)?.arg, 1);
  t.assert(action.getCache(1)?.inProgress instanceof Promise);

  await promise;
  const { arg, current, inProgress, invalid } = action.getCache(1) ?? {};
  t.is(arg, 1);
  t.assert(current?.kind === 'value' && current.value === 2);
  t.is(inProgress, undefined);
  t.is(invalid, false);
});

test('getCacheValue', async (t) => {
  const action = new Action(async (x: number) => {
    await Promise.resolve();
    return x * 2;
  });

  t.is(action.getCacheValue(1), undefined);

  const promise = action.execute(1);
  t.is(action.getCacheValue(1), undefined);

  await promise;
  t.is(action.getCacheValue(1), 2);
});

test('getCacheError', async (t) => {
  const action = new Action(async () => {
    await Promise.resolve();
    throw Error();
  });

  t.is(action.getCacheError(1), undefined);

  const promise = action.execute(1);
  t.is(action.getCacheError(1), undefined);

  await t.throwsAsync(() => promise);
  t.truthy(action.getCacheError(1));
});

test('updateCache', async (t) => {
  const action = new Action(async (x: number) => {
    await wait(10);
    return { value: x * 2 };
  });

  action.updateCache(1, () => {
    t.fail();
  });

  await action.execute(1);
  action.updateCache(1, (s) => {
    s.value = 42;
  });

  t.deepEqual(action.getCacheValue(1), { value: 42 });
});

test('updateCacheAll', async (t) => {
  const action = new Action(async (x: number) => {
    await wait(10);
    if (x === 2) throw Error();
    return { value: x * 2 };
  });

  action.updateCacheAll(() => {
    t.fail();
  });

  await action.execute(1);
  await t.throwsAsync(() => action.execute(2));
  const promise = action.execute(3);
  action.updateCacheAll((s, arg) => {
    t.is(arg, 1);
    s.value = arg + 1;
  });
  await promise;

  t.deepEqual(action.getCacheValue(1), { value: 2 });
});

test('clearCache', async (t) => {
  let executed = 0;

  const action = new Action(
    async (x: number) => {
      await Promise.resolve();
      executed++;
      return x * 2;
    },
    { invalidateAfter: 1000 }
  );

  t.is(await action.get(1), 2);

  action.clearCache(1);
  action.clearCache(2);
  t.is(action.getCache(1), undefined);
  t.is(action.getCache(2), undefined);

  t.is(await action.get(1), 2);
  t.is(executed, 2);
});

test('clearCache function', async (t) => {
  let executed = 0;

  const action = new Action(
    async (x: number) => {
      await Promise.resolve();
      executed++;
      if (x === 1) return 1;
      else throw Error('error');
    },
    {
      invalidateAfter: (v, e) => {
        if (executed === 1) t.is(v, 1);
        else t.truthy(e);
        return 1000;
      },
    }
  );

  t.is(await action.get(1), 1);

  action.clearCache(1);
  action.clearCache(2);
  t.is(action.getCache(1), undefined);
  t.is(action.getCache(2), undefined);

  await t.throwsAsync(() => action.get(2));
  t.is(executed, 2);
});

test('clearCacheAll', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    executed++;
    return x * 2;
  });

  t.is(await action.get(1), 2);

  action.clearCacheAll();
  t.is(action.getCache(1), undefined);

  t.is(await action.get(1), 2);
  t.is(executed, 2);
});

test('invalidateCache', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    executed++;
    return x * 2;
  });

  t.is(await action.get(1), 2);

  action.invalidateCache(1);
  action.invalidateCache(2);
  t.is(action.getCacheValue(1), 2);
  t.is(action.getCache(1)?.invalid, true);
  t.is(action.getCache(2), undefined);

  t.is(await action.get(1), 2);
  t.is(action.getCache(1)?.invalid, false);

  t.is(executed, 2);
});

test('invalidateCacheAll', async (t) => {
  let executed = 0;

  const action = new Action(async (x: number) => {
    await Promise.resolve();
    executed++;
    return x * 2;
  });

  t.is(await action.get(1), 2);

  action.invalidateCacheAll();
  t.is(action.getCacheValue(1), 2);
  t.is(action.getCache(1)?.invalid, true);

  t.is(await action.get(1), 2);
  t.is(action.getCache(1)?.invalid, false);

  t.is(executed, 2);
});

test('update timer', async (t) => {
  const action = new Action(
    async (x: number) => {
      await Promise.resolve();
      return x * 2;
    },
    { invalidateAfter: 100 }
  );

  await action.execute(1);
  t.is(action.getCacheValue(1), 2);
  t.truthy(action.getCache(1)?.timer);

  await sleep(50);
  await action.execute(1);
  t.is(action.getCacheValue(1), 2);
  t.truthy(action.getCache(1)?.timer);

  await sleep(75);
  t.is(action.getCacheValue(1), 2);
  t.truthy(action.getCache(1)?.timer);

  await sleep(50);
  t.is(action.getCacheValue(1), 2);
  t.is(action.getCache(1)?.timer, undefined);
});
