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
    await sleep(1);
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
    await sleep(1);
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
    await sleep(1);
    throw Error();
  });

  await expect(action().get()).rejects.toEqual(Error());
  await expect(action().get()).rejects.toEqual(Error());
});

test('execute', async () => {
  let executed = 0;

  const action = Action.create(async (x: number) => {
    await sleep(1);
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
    await sleep(2);
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

// test('retry', async (t) => {
//   let executed = 0;

//   const action = Action.create(async (x: number) => {
//     await sleep(1);
//     if (executed++ === 0) throw Error();
//     return x * 2;
//   });

//   t.is(await action(1).get({ retries: 1 }), 2);
//   t.is(executed, 2);
// });

// test('dangling execution', async (t) => {
//   const action = Action.create(async (x: number) => {
//     await sleep(1);
//     return x * 2;
//   });

//   const promise = action(1).execute();
//   action(1).clearCache();

//   t.is(await promise, 2);
//   t.is(action(1).getCache(), undefined);
// });

// test('dangling execution error', async (t) => {
//   const action = Action.create(async () => {
//     await sleep(1);
//     throw Error();
//   });

//   const promise = action().execute();
//   action().clearCache();

//   await t.throwsAsync(() => promise);
//   t.is(action().getCache(), undefined);
// });

// test('subscribe', async (t) => {
//   const action = Action.create(async (x: number) => {
//     await wait(10);
//     return x * 2;
//   });

//   t.plan(3);

//   let count = 0;
//   action(1).subscribe((state) => {
//     if (count === 0) {
//       t.deepEqual(state, {});
//     } else if (count === 1) {
//       t.deepEqual(state, { value: undefined, error: undefined, isLoading: true, stale: false });
//     } else {
//       t.deepEqual(state, { value: 2, error: undefined, isLoading: false, stale: false });
//     }
//     count++;
//   });

//   await action(1).execute();
// });

// test('subscribe error', async (t) => {
//   const action = Action.create(async (): Promise<number> => {
//     await wait(10);
//     throw Error();
//   });

//   t.plan(4);

//   let count = 0;
//   action().subscribe((state) => {
//     if (count === 0) {
//       t.deepEqual(state, {});
//     } else if (count === 1) {
//       t.deepEqual(state, { value: undefined, error: undefined, isLoading: true, stale: false });
//     } else {
//       t.deepEqual(state, { value: undefined, error: Error(), isLoading: false, stale: false });
//     }
//     count++;
//   });

//   await t.throwsAsync(() => action().execute());
// });

// test.serial('static clearCacheAll', async (t) => {
//   let executed = 0;

//   const action = Action.create(async (x: number) => {
//     await sleep(1);
//     executed++;
//     return x * 2;
//   });

//   t.is(await action(1).get(), 2);
//   Action.clearCacheAll();
//   t.is(await action(1).get(), 2);
//   t.is(executed, 2);
// });

// test('getCache', async (t) => {
//   const action = Action.create(async (x: number) => {
//     await sleep(1);
//     return x * 2;
//   });

//   t.is(action(1).getCache(), undefined);

//   const promise = action(1).execute();
//   t.deepEqual(action(1).getCache(), { value: undefined, error: undefined, isLoading: true, stale: false });

//   await promise;
//   t.deepEqual(action(1).getCache(), { value: 2, error: undefined, isLoading: false, stale: false });
// });

// test('update', async (t) => {
//   const action = Action.create(async (x: number) => {
//     await wait(10);
//     return { value: x * 2 };
//   });

//   // action(1).updateCache(() => {
//   //   t.fail();
//   // });

//   // await action.execute(1);
//   // action.updateCache(1, (s) => {
//   //   s.value = 42;
//   // });

//   // t.deepEqual(action.getCacheValue(1), { value: 42 });
//   t.pass();
// });

// test('clearCache', async (t) => {
//   let executed = 0;

//   const action = Action.create(
//     async (x: number) => {
//       await sleep(1);
//       executed++;
//       return x * 2;
//     },
//     { invalidateAfter: 1000 }
//   );

//   t.is(await action(1).get(), 2);

//   action(1).clearCache();
//   action(2).clearCache();
//   t.is(action(1).getCache(), undefined);
//   t.is(action(2).getCache(), undefined);

//   t.is(await action(1).get(), 2);
//   t.is(executed, 2);
// });

// test('clearCache function', async (t) => {
//   let executed = 0;

//   const action = Action.create(
//     async (x: number) => {
//       await sleep(1);
//       executed++;
//       if (x === 1) return 1;
//       else throw Error('error');
//     },
//     {
//       invalidateAfter: ({ value, error }) => {
//         if (executed === 1) t.is(value, 1);
//         else t.truthy(error);
//         return 1000;
//       },
//     }
//   );

//   t.is(await action(1).get(), 1);

//   action(1).clearCache();
//   action(2).clearCache();
//   t.is(action(1).getCache(), undefined);
//   t.is(action(2).getCache(), undefined);

//   await t.throwsAsync(() => action(2).get());
//   t.is(executed, 2);
// });

// test.serial('clearAfter', async (t) => {
//   const action = Action.create(
//     async () => {
//       return 1;
//     },
//     {
//       invalidateAfter: () => {
//         return 250;
//       },
//       clearAfter: () => {
//         return 750;
//       },
//     }
//   );

//   t.is(await action().get(), 1);
//   t.deepEqual(action().getCache(), { value: 1, error: undefined, isLoading: false, stale: false });

//   await sleep(500);
//   t.deepEqual(action().getCache(), { value: 1, error: undefined, isLoading: false, stale: true });

//   await sleep(500);
//   t.is(action().getCache(), undefined);
// });

// test.serial('clearAfter global', async (t) => {
//   Action.options = {
//     invalidateAfter: 250,
//     clearAfter: 750,
//   };

//   const action = Action.create(async () => {
//     return 1;
//   });

//   t.is(await action().get(), 1);
//   t.deepEqual(action().getCache(), { value: 1, error: undefined, isLoading: false, stale: false });

//   await sleep(500);
//   t.deepEqual(action().getCache(), { value: 1, error: undefined, isLoading: false, stale: true });

//   await sleep(500);
//   t.is(action().getCache(), undefined);
// });

// test('clearCacheAll', async (t) => {
//   let executed = 0;

//   const action = Action.create(async (x: number) => {
//     await sleep(1);
//     executed++;
//     return x * 2;
//   });

//   t.is(await action(1).get(), 2);

//   action.clearCacheAll();
//   t.is(action(1).getCache(), undefined);

//   t.is(await action(1).get(), 2);
//   t.is(executed, 2);
// });

// test('invalidateCache', async (t) => {
//   let executed = 0;

//   const action = Action.create(async (x: number) => {
//     await sleep(1);
//     executed++;
//     return x * 2;
//   });

//   t.is(await action(1).get(), 2);

//   action(1).invalidateCache();
//   action(2).invalidateCache();
//   t.deepEqual(action(1).getCache(), {
//     value: 2,
//     error: undefined,
//     isLoading: false,
//     stale: true,
//   });
//   t.is(action(2).getCache(), undefined);

//   t.is(await action(1).get(), 2);
//   t.deepEqual(action(1).getCache(), {
//     value: 2,
//     error: undefined,
//     isLoading: false,
//     stale: false,
//   });

//   t.is(executed, 2);
// });

// test('invalidateCacheAll', async (t) => {
//   let executed = 0;

//   const action = Action.create(async () => {
//     await sleep(1);
//     return executed++;
//   });

//   t.is(await action().get(), 0);

//   action.invalidateCacheAll();
//   t.deepEqual(action().getCache(), {
//     value: 0,
//     error: undefined,
//     isLoading: false,
//     stale: true,
//   });

//   t.is(await action().get(), 1);
//   t.deepEqual(action().getCache(), {
//     value: 1,
//     error: undefined,
//     isLoading: false,
//     stale: false,
//   });

//   t.is(executed, 2);
// });

test('update timer', async () => {
  const action = Action.create(
    async (x: number) => {
      await sleep(1);
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
