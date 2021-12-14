import { createPushResource, Resource } from '../src';
import { sleep } from '../src/helpers/misc';

jest.useFakeTimers();

afterEach(() => {
  Resource.options = {};
  jest.runAllTimers();
});

test('subscribe', async () => {
  let value;

  const resource = createPushResource<undefined, number>({
    connect({ onConnect, onDisconnect, onData }) {
      let cancel = false;

      (async () => {
        onConnect();

        for (let i = 0; i < 100; i++) {
          await sleep(1);
          if (cancel) return;

          onData(({ value = 0 }) => value + 1);
        }

        onDisconnect();
      })();

      return () => {
        cancel = true;
      };
    },
  });

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
    connect({ onConnect, onDisconnect, onData }) {
      let cancel = false;

      (async () => {
        onConnect();

        for (let i = 0; i < 100; i++) {
          await sleep(1);
          if (cancel) return;

          onData(({ value = 0 }) => value + 1);
        }

        onDisconnect();
      })();

      return () => {
        cancel = true;
      };
    },
  });

  const cancel = resource().subscribe((state) => {
    value = state.value;
  });

  jest.runAllTimers();
  await Promise.resolve();

  for (let i = 2; i <= 4; i++) {
    jest.runAllTimers();
    await Promise.resolve();
    jest.runAllTimers();

    expect(value).toBe(100 + i);
  }

  cancel();

  jest.runAllTimers();
  await Promise.resolve();
  jest.runAllTimers();
  expect(value).toBe(104);
});
