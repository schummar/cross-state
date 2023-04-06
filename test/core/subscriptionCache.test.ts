import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createSubscriptionCache } from '../../src';
import { flushPromises, sleep } from '../testHelpers';

class WebSocket {
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

describe('subscriptionCache', () => {
  test('websocket', async () => {
    const subscriptionCache = createSubscriptionCache<any[]>(function () {
      this.updateConnectionState('connecting');

      const ws = new WebSocket('');
      ws.addEventListener('message', (event) => {
        this.updateValue((x) => (x ?? []).concat(event.data));
      });
      ws.addEventListener('error', (error) => this.updateError(error));
      ws.addEventListener('open', () => this.updateConnectionState('open'));
      ws.addEventListener('close', () => this.updateConnectionState('closed'));

      this.updateValue(sleep(2).then(() => [42]));
      this.updateValue((x) => (x ?? []).concat(43));

      ws.once('open', () => {
        ws.send('hello');
      });

      return () => {
        ws.close();
        this.updateConnectionState('closed');
      };
    });

    const listener = vi.fn();
    const stateListener = vi.fn();
    const cancel = subscriptionCache.subscribe(listener);
    subscriptionCache.state.subscribe(stateListener);

    expect(listener.mock.calls).toEqual([[undefined, undefined]]);

    vi.advanceTimersByTime(2);
    await flushPromises();

    expect(listener.mock.calls).toEqual([
      [undefined, undefined],
      [[42], undefined],
      [[42, 43], [42]],
      [
        [42, 43, 'hello'],
        [42, 43],
      ],
    ]);

    cancel();

    expect(stateListener.mock.calls).toEqual([
      [{ connectionState: 'connecting', error: undefined }, undefined],
      [
        { connectionState: 'open', error: undefined },
        { connectionState: 'connecting', error: undefined },
      ],
      [
        { connectionState: 'closed', error: undefined },
        { connectionState: 'open', error: undefined },
      ],
    ]);
  });

  test('inner function', async () => {
    const subscriptionCache = createSubscriptionCache<number>(() => ({ updateValue }) => {
      updateValue(1);
    });
    await subscriptionCache.once();
    expect(subscriptionCache.get()).toBe(1);
  });
});
