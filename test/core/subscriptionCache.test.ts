import { describe, test } from 'vitest';
import WebSocket from 'ws';
import { createSubscriptionCache } from '../../src';
import { sleep } from '../testHelpers';

describe('subscriptionCache', () => {
  test('websocket', async () => {
    const subscriptionCache = createSubscriptionCache<any[]>(function () {
      this.updateConnectionState('connecting');

      const ws = new WebSocket('wss://ws.postman-echo.com/raw');
      ws.addEventListener('message', (event) => {
        this.updateValue((x) => (x ?? []).concat(event.data));
      });
      ws.addEventListener('error', (error) => this.updateError(error));
      ws.addEventListener('open', () => this.updateConnectionState('open'));
      ws.addEventListener('close', () => this.updateConnectionState('closed'));

      this.updateValue(sleep(500).then(() => [42]));
      this.updateValue((x) => (x ?? []).concat(43));

      ws.once('open', () => {
        ws.send('hello');
      });

      return () => {
        ws.close();
        this.updateConnectionState('closed');
      };
    });

    const cancel = subscriptionCache.sub((value) => console.log({ value }));
    subscriptionCache.state.sub((state) => console.log({ state }));

    await sleep(1000);

    cancel();

    await sleep(3000);
  });
});
