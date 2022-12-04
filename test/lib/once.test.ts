import { onceValue } from '@core/once';
import { describe, expect, test } from 'vitest';
import { fetchStore, once } from '../../src';

describe('once', () => {
  test('once has value', async () => {
    const state = fetchStore(async () => 1);
    const promise = once(state.subValue, (x): x is number => x !== undefined);

    const value = await promise;
    expect(value).toBe(1);
  });

  test('onceValue with value', async () => {
    const state = fetchStore(async () => 1);
    const promise = onceValue(state.sub);

    const value = await promise;
    expect(value).toBe(1);
  });

  test('onceValue with error', async () => {
    const state = fetchStore(async () => {
      throw Error('once error');
    });
    const promise = onceValue(state.sub);

    await expect(promise).rejects.toThrowError('once error');
  });
});
