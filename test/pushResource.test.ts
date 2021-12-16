import { createPushResource, PushResourceOptions, Resource, ResourceState } from '../src';
import { sleep } from '../src/helpers/misc';

jest.useFakeTimers();

afterEach(() => {
  Resource.options = {};
  jest.runAllTimers();
});

const connect: PushResourceOptions<any, any>['connect'] = ({ onConnected, onDisconnected, onData }) => {
  let cancel = false;

  (async () => {
    onConnected();

    for (let i = 0; i < 100; i++) {
      await sleep(1);
      if (cancel) return;

      onData(({ value = 0 }) => value + 1);
    }

    onDisconnected();
  })();

  return () => {
    cancel = true;
  };
};

test('subscribe', async () => {
  let value;

  const resource = createPushResource<undefined, number>({ connect });

  const cancel = resource().subscribe((state) => {
    value = state.value;
  });

  expect(value).toBe(undefined);

  for (let i = 1; i <= 3; i++) {
    jest.runAllTimers();
    await Promise.resolve();
    jest.runAllTimers();

    expect(value).toBe(i);
  }

  cancel();

  jest.runAllTimers();
  await Promise.resolve();
  jest.runAllTimers();
  expect(value).toBe(3);
});

test('subscribe with getInitial', async () => {
  let value;

  const resource = createPushResource<undefined, number>({
    async getInital() {
      await sleep(200);
      return 100;
    },
    connect,
  });

  const cancel = resource().subscribe((state) => {
    value = state.value;
  });

  jest.runAllTimers();
  await Promise.resolve();
  jest.runAllTimers();
  await Promise.resolve();

  for (let i = 3; i <= 5; i++) {
    jest.runAllTimers();
    await Promise.resolve();
    jest.runAllTimers();

    expect(value).toBe(100 + i);
  }

  cancel();

  jest.runAllTimers();
  await Promise.resolve();
  jest.runAllTimers();
  expect(value).toBe(105);
});

test('subscribe with getInitial error', async () => {
  let state: ResourceState<number> | undefined;

  const resource = createPushResource<undefined, number>({
    async getInital() {
      await sleep(200);
      throw Error();
    },
    connect({ onConnected, onDisconnected, onData }) {
      let cancel = false;

      (async () => {
        onConnected();

        for (let i = 0; i < 100; i++) {
          await sleep(1);
          if (cancel) return;

          onData(({ value = 0, error }) => {
            if (error) throw error;
            return value + 1;
          });
        }

        onDisconnected();
      })();

      return () => {
        cancel = true;
      };
    },
  });

  const cancel = resource().subscribe((_state) => {
    state = _state;
  });

  jest.runAllTimers();
  await Promise.resolve();
  jest.runAllTimers();
  await Promise.resolve();
  jest.runAllTimers();
  await Promise.resolve();
  jest.runAllTimers();

  expect(state).toEqual({
    value: undefined,
    error: Error(),
    isLoading: false,
    stale: false,
  });
  cancel();
});
