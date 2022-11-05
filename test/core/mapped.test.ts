import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.skip('mapped', () => {
  test('get', () => {
    const state = store(1);
    const value = state.map((x) => x * 2).get();

    expect(value).toBe(2);
  });

  test('subscribe', () => {
    const state = store(1);
    const fn = vi.fn(() => undefined);
    state.map((x) => x * 2).subscribe(fn);

    state.update(2);

    expect(fn.mock.calls).toEqual([
      [2, undefined],
      [4, 2],
    ]);
  });

  test('update', () => {
    const state = store({ x: 1 });
    const mapped = state.map('x');

    mapped.update(2);

    expect(state.get()).toEqual({ x: 2 });
    expect(mapped.get()).toEqual(2);
  });
});
