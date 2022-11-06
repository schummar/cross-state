import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mapped', () => {
  test('get', () => {
    const dep = store(1);
    const value = dep.map((x) => x * 2).get();

    expect(value).toBe(2);
  });

  test('get nested', () => {
    const dep1 = store(1);
    const dep2 = dep1.map((x) => x * 2);
    const value = dep2.map((x) => x * 2).get();

    expect(value).toBe(4);
  });

  test('subscribe', async () => {
    const state = store(1);
    const fn = vi.fn(() => undefined);
    state.map((x) => x * 2).sub(fn);

    state.update(2);

    expect(fn.mock.calls).toEqual([
      [2, undefined],
      [4, 2],
    ]);
  });

  test('subscribe nested', async () => {
    const dep1 = store(1);
    const dep2 = dep1.map((x) => x * 2);
    const fn = vi.fn(() => undefined);
    dep2.map((x) => x * 2).sub(fn);

    dep1.update(2);

    expect(fn.mock.calls).toEqual([
      [4, undefined],
      [8, 4],
    ]);
  });

  test('update', () => {
    const state = store({ x: 1 });
    const mapped = state.map('x');

    mapped.update(2);

    expect(state.get()).toEqual({ x: 2 });
    expect(mapped.get()).toEqual(2);
  });

  test('update nested', () => {
    const dep1 = store({ x: { y: 1 } });
    const dep2 = dep1.map('x');
    const mapped = dep2.map('y');

    mapped.update(2);

    expect(dep1.get()).toEqual({ x: { y: 2 } });
    expect(dep2.get()).toEqual({ y: 2 });
    expect(mapped.get()).toEqual(2);
  });
});
