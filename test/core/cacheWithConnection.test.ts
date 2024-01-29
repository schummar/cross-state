import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createCache } from '../../src';
import { flushPromises, sleep } from '../testHelpers';

class MockWebSocket {
  listeners = new Set<{ event: string; callback: (event: any) => void }>();

  onceListeners = new Set<{ event: string; callback: (event: any) => void }>();

  constructor(url: string) {
    this.url = url;
    setTimeout(() => this.emit('open', {}), 1);
  }

  url: string;

  addEventListener(event: string, callback: (event: any) => void) {
    this.listeners.add({ event, callback });
  }

  once(event: string, callback: (event: any) => void) {
    this.onceListeners.add({ event, callback });
  }

  send(data: string) {
    this.emit('message', { data });
  }

  close() {
    this.emit('close', {});
  }

  private emit(event: string, data: any) {
    for (const listener of this.listeners) {
      if (listener.event === event) {
        listener.callback(data);
      }
    }

    for (const listener of this.onceListeners) {
      if (listener.event === event) {
        listener.callback(data);
      }
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('cache with connection', () => {
  test('websocket example', async () => {
    const fetchEndpoint = vi.fn(async () => 1);

    const cache = createCache<number>(() => async ({ connect }) => {
      await connect(({ updateValue, updateIsConnected, close }) => {
        const ws = new MockWebSocket('');

        ws.addEventListener('open', () => updateIsConnected(true));
        ws.addEventListener('close', close);
        ws.addEventListener('message', (event) =>
          updateValue((x) => {
            return x + Number(event.data);
          }),
        );

        setTimeout(() => ws.send('2'), 2);
        setTimeout(() => ws.send('3'), 3);

        return () => ws.close();
      });

      return await fetchEndpoint();
    });

    const listener = vi.fn();
    const stateListener = vi.fn();
    cache.subscribe(listener);
    cache.state.subscribe(stateListener);

    const promises = () => Promise.all(listener.mock.calls.map((x) => x[0]));
    const states = () => stateListener.mock.calls.map((x) => x[0]);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(await promises()).toEqual([1]);
    expect(states()).toMatchObject([
      { status: 'pending', isUpdating: true, isConnected: false },
      { status: 'value', value: 1, isUpdating: false, isConnected: false },
      { status: 'value', value: 1, isUpdating: false, isConnected: true },
    ]);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(await promises()).toEqual([1, 3]);
    expect(states().slice(3)).toMatchObject([{ status: 'value', value: 3 }]);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(await promises()).toEqual([1, 3, 6]);
    expect(states().slice(4)).toMatchObject([{ status: 'value', value: 6 }]);
  });

  test('reconnect', async () => {
    const cache = createCache<number>(() => async ({ connect }) => {
      await connect(({ updateValue, updateIsConnected }) => {
        let stopped = false;

        (async () => {
          for (const action of [
            () => {
              updateIsConnected(true);
            },
            () => {
              updateValue(2);
            },
            () => {
              updateIsConnected(false);
            },
            () => {
              updateIsConnected(true);
              updateValue(sleep(1).then(() => 3));
              updateValue(4);
            },
          ]) {
            await sleep(1);
            if (stopped) return;
            action();
          }
        })();

        return () => {
          stopped = true;
        };
      });

      return 1;
    });

    const subscriber = vi.fn();
    cache.subscribe(() => undefined);
    cache.state.subscribe(subscriber);

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1);
      await flushPromises();
    }

    expect(subscriber.mock.calls.map((x) => x[0])).toMatchObject([
      { status: 'pending', isUpdating: true, isConnected: false },
      { status: 'value', value: 1, isUpdating: false, isConnected: false },
      { status: 'value', value: 1, isUpdating: false, isConnected: true },
      { status: 'value', value: 2, isUpdating: false, isConnected: true },
      { status: 'value', value: 2, isUpdating: false, isConnected: false },
      { status: 'value', value: 2, isUpdating: false, isConnected: true },
      { status: 'value', value: 3, isUpdating: false, isConnected: true },
      { status: 'value', value: 4, isUpdating: false, isConnected: true },
    ]);
  });

  test('inactive/active', async () => {
    const initialLoad = vi.fn(() => 0);

    const cache = createCache<number>(
      () =>
        async ({ connect }) => {
          await connect(({ updateValue, updateIsConnected, close }) => {
            updateIsConnected(true);
            let i = 1;
            const interval = setInterval(() => updateValue(i++), 1);
            return () => clearInterval(interval);
          });

          return initialLoad();
        },
      { retain: 1 },
    );

    const subscriber = vi.fn();
    const cancel = cache.subscribe(() => undefined);
    cache.state.subscribe(subscriber);

    await flushPromises();

    // Initial load done
    expect(subscriber.mock.calls.map((x) => x[0])).toMatchObject([
      { status: 'pending', isStale: true, isUpdating: true, isConnected: false },
      { status: 'value', value: 0, isStale: false, isUpdating: false, isConnected: false },
      { status: 'value', value: 0, isStale: false, isUpdating: false, isConnected: true },
    ]);

    vi.advanceTimersByTime(1);
    await flushPromises();

    // First update
    expect(subscriber.mock.calls.slice(3).map((x) => x[0])).toMatchObject([
      { status: 'value', value: 1, isStale: false, isUpdating: false, isConnected: true },
    ]);

    cancel();
    vi.advanceTimersByTime(1);
    await flushPromises();

    // Second update still happens despite cancel because of retain
    expect(subscriber.mock.calls.slice(4).map((x) => x[0])).toMatchObject([
      { status: 'value', value: 2, isStale: false, isUpdating: false, isConnected: true },
      { status: 'value', value: 2, isStale: false, isUpdating: false, isConnected: false },
    ]);

    vi.advanceTimersByTime(1);
    await flushPromises();

    // Third update doesn't happen
    expect(subscriber.mock.calls.slice(6).map((x) => x[0])).toMatchObject([]);

    cache.subscribe(() => undefined);
    vi.advanceTimersByTime(1);
    await flushPromises();

    expect(subscriber.mock.calls.slice(6).map((x) => x[0])).toMatchObject([
      { status: 'value', value: 2, isStale: true, isUpdating: false, isConnected: false },
      { status: 'value', value: 2, isStale: true, isUpdating: true, isConnected: false },
      { status: 'value', value: 0, isStale: false, isUpdating: false, isConnected: false },
      { status: 'value', value: 0, isStale: false, isUpdating: false, isConnected: true },
      { status: 'value', value: 1, isStale: false, isUpdating: false, isConnected: true },
    ]);
  });
});
