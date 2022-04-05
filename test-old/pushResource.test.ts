import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createPushResource, PushResourceOptions, Resource } from '../src';
import { sleep } from './_helpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.resetAllMocks();
  Resource.options = {};
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
    vi.advanceTimersByTime(1);
    expect(value).toBe(i);
  }

  cancel();

  vi.advanceTimersByTime(1000);
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

  vi.advanceTimersByTime(5);
  await Promise.resolve();
  await Promise.resolve();
  expect(value).toBe(undefined);

  vi.advanceTimersByTime(5);
  await Promise.resolve();
  await Promise.resolve();
  expect(value).toBe(110);

  vi.advanceTimersByTime(50);
  expect(value).toBe(160);

  cancel();

  vi.advanceTimersByTime(1000);
  await Promise.resolve();
  await Promise.resolve();
  expect(value).toBe(160);
});

test('subscribe with getInitial error', async () => {
  const resource = createPushResource<undefined, number>({
    async getInital() {
      throw Error();
    },
    connect: createConnect(),
  });

  const cancel = resource().subscribe(() => undefined);
  await expect(resource().get()).rejects.toBeTruthy();
  expect(resource().getCache()).toEqual({ state: 'error', error: Error(), isLoading: false });

  vi.advanceTimersByTime(1);
  expect(resource().getCache()).toEqual({ state: 'error', error: Error(), isLoading: false });
  cancel();
});

test('subscribe with getInitial error and non incremental update', async () => {
  const resource = createPushResource<undefined, number>({
    async getInital() {
      throw Error();
    },
    connect: createConnect(false),
  });

  const cancel = resource().subscribe(() => undefined);
  await expect(resource().get()).rejects.toBeTruthy();
  expect(resource().getCache()).toEqual({ state: 'error', error: Error(), isLoading: false });

  vi.advanceTimersByTime(1);
  expect(resource().getCache()).toEqual({ state: 'value', value: 1, isLoading: false });
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
  vi.advanceTimersByTime(10);
  await expect(promise).resolves.toBe(52);
});

test('clear', async () => {
  const resource = createPushResource({
    async getInital() {
      return 0;
    },
    connect: createConnect(),
  });
  const cancel = resource().subscribe(() => undefined);
  await resource().get();
  expect(resource().getCache().value).toBe(0);

  resource.clearCacheAll();
  expect(resource().getCache().value).toBe(undefined);

  vi.advanceTimersByTime(1);
  expect(resource().getCache().value).toBe(1);
  cancel();
});

test('onDisconnected', async () => {
  const resource = createPushResource({
    connect: createConnect(),
  });
  const cancel = resource().subscribe(() => undefined);

  vi.advanceTimersByTime(100);
  expect(resource().getCache()).toEqual({ state: 'value', value: 100, isLoading: false, isStale: true });
  cancel();
});

test('error in onUpdate', async () => {
  const resource = createPushResource({
    connect({ onConnected, onData }) {
      onConnected();
      onData(() => {
        throw Error();
      });
      return () => undefined;
    },
  });

  await expect(resource().get()).rejects.toBeTruthy();
  expect(resource().getCache()).toEqual({ state: 'error', error: Error(), isLoading: false });
});

test('onError', async () => {
  const resource = createPushResource({
    connect({ onConnected, onError }) {
      onConnected();
      onError(Error());
      return () => undefined;
    },
  });

  await expect(resource().get()).rejects.toBeTruthy();
  expect(resource().getCache()).toEqual({ state: 'error', error: Error(), isLoading: false });
});

test('update', async () => {
  const resource = createPushResource({
    connect: createConnect(),
  });

  const promise = resource().get();
  vi.advanceTimersByTime(1);
  await promise;
  resource().update(({ value = 0 }) => value * 100);
  expect(resource().getCache().value).toBe(100);
});
