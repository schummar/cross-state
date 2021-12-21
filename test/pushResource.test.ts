import { afterEach, expect, jest, test } from '@jest/globals';
import { createPushResource, PushResourceOptions, Resource, ResourceState } from '../src';
import { sleep } from './_helpers';

jest.useFakeTimers();

afterEach(() => {
  Resource.options = {};
  jest.runAllTimers();
});

const createConnect =
  (incremental = true): PushResourceOptions<undefined, number>['connect'] =>
  ({ onConnected, onDisconnected, onData }) => {
    let cancel = false;

    (async () => {
      onConnected();

      let i = 0;
      function trigger() {
        if (cancel || i++ >= 100) return onDisconnected();
        setTimeout(() => {
          onData(({ value = 0, error }) => {
            if (!incremental) return i;
            if (error) throw error;
            return value + 1;
          });
          trigger();
        }, 1);
      }
      trigger();
    })();

    return () => {
      cancel = true;
    };
  };

test('subscribe', async () => {
  let value;

  const resource = createPushResource<undefined, number>({ connect: createConnect() });

  const cancel = resource().subscribe((state) => {
    value = state.value;
  });

  expect(value).toBe(undefined);

  for (let i = 1; i <= 50; i++) {
    jest.advanceTimersByTime(1);
    expect(value).toBe(i);
  }

  cancel();

  jest.runAllTimers();
  await Promise.resolve();
  expect(value).toBe(50);
});

test('subscribe with getInitial', async () => {
  let value;

  const resource = createPushResource<undefined, number>({
    async getInital() {
      await sleep(10);

      return 100;
    },
    connect: createConnect(),
  });

  const cancel = resource().subscribe((state) => {
    value = state.value;
  });

  jest.advanceTimersByTime(5);
  await Promise.resolve();
  await Promise.resolve();
  expect(value).toBe(undefined);

  jest.advanceTimersByTime(5);
  await Promise.resolve();
  await Promise.resolve();
  expect(value).toBe(110);

  jest.advanceTimersByTime(50);
  expect(value).toBe(160);

  cancel();

  jest.runAllTimers();
  await Promise.resolve();
  expect(value).toBe(160);
});

test('subscribe with getInitial error', async () => {
  let state: ResourceState<number> | undefined;

  const resource = createPushResource<undefined, number>({
    async getInital() {
      await sleep(10);
      throw Error();
    },
    connect: createConnect(),
  });

  const cancel = resource().subscribe((_state) => {
    state = _state;
  });

  jest.advanceTimersByTime(5);
  await Promise.resolve();
  await Promise.resolve();
  expect(state?.error).toBe(undefined);

  jest.advanceTimersByTime(5);
  await Promise.resolve();
  await Promise.resolve();
  expect(state?.error).toEqual(Error());
  cancel();
});

test('get', async () => {
  const resource = createPushResource({
    async getInital() {
      await sleep(10);
      return 42;
    },
    connect: createConnect(),
  });

  const promise = resource().get();
  jest.advanceTimersByTime(10);
  await expect(promise).resolves.toBe(52);
});
