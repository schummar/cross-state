import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { storeSet } from '../../src';
import { flushPromises, getValues } from '../testHelpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.skip('storeSet', () => {
  test('create', () => {
    const state = storeSet(async () => 1);
    expect(state).toBeInstanceOf(Function);
  });

  test('get', async () => {
    const state = storeSet(async (n: number) => n + 1);
    state(1).subscribe(vi.fn());
    state(2).subscribe(vi.fn());

    await flushPromises();
    expect(state(1).get()).toBe(2);
    expect(state(2).get()).toBe(3);
  });

  test('subscribe', async () => {
    const state = storeSet(async (n: number) => n + 1);
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    state(1).subscribe(listener1);
    state(2).subscribe(listener2);

    await flushPromises();
    expect(getValues(listener1)).toEqual([undefined, 2]);
    expect(getValues(listener2)).toEqual([undefined, 3]);
  });
});
