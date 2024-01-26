import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createCache } from '../../src';
import { flushPromises } from '../testHelpers';

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
    expect(await promises()).toEqual([1]);
    expect(states()).toMatchObject([{ status: 'pending' }, { status: 'value', value: 1 }]);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(await promises()).toEqual([1, 3]);
    expect(states().slice(2)).toMatchObject([{ status: 'value', value: 3 }]);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(await promises()).toEqual([1, 3, 6]);
    expect(states().slice(3)).toMatchObject([{ status: 'value', value: 6 }]);
  });
});
