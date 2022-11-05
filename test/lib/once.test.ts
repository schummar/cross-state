import { describe, expect, test, vi } from 'vitest';
import { once, store } from '../../src';
import { FakeWebSocket } from '../core/subscriptionStore.test';

describe.skip('once', () => {
  test('once has value', async () => {
    const state = store<number>(function () {
      const ws = new FakeWebSocket([[1, 1]]);
      ws.onmessage = this.update;
      return () => undefined;
    });

    const promise = once(state.subscribe);
    vi.advanceTimersByTime(1);
    const value = await promise;
    expect(value).toBe(1);
  });

  test('once with error', async () => {
    const state = store<number>(function () {
      const ws = new FakeWebSocket([[Error('error'), 1]]);
      ws.onerror = this.updateError;
      return () => undefined;
    });

    const promise = once(state.subscribe);
    vi.advanceTimersByTime(1);

    expect(promise).rejects.toThrow(Error('error'));
  });
});
