import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mapped', () => {
  test('get', () => {
    const dep = createStore(1);
    const value = dep.map((x) => x * 2).get();

    expect(value).toBe(2);
  });

  test('get nested', () => {
    const dep1 = createStore(1);
    const dep2 = dep1.map((x) => x * 2);
    const value = dep2.map((x) => x * 2).get();

    expect(value).toBe(4);
  });

  test('subscribe', async () => {
    const state = createStore(1);
    const listener = vi.fn(() => undefined);
    state.map((x) => x * 2).subscribe(listener);

    state.set(2);

    expect(listener.mock.calls).toEqual([
      [2, undefined],
      [4, 2],
    ]);
  });

  test('subscribe nested', async () => {
    const dep1 = createStore(1);
    const dep2 = dep1.map((x) => x * 2);
    const listener = vi.fn(() => undefined);
    dep2.map((x) => x * 2).subscribe(listener);

    dep1.set(2);

    expect(listener.mock.calls).toEqual([
      [4, undefined],
      [8, 4],
    ]);
  });

  test('update', () => {
    const state = createStore({ x: 1 });
    const mapped = state.map('x');

    mapped.set(2);

    expect(state.get()).toEqual({ x: 2 });
    expect(mapped.get()).toEqual(2);
  });

  test('update nested', () => {
    const dep1 = createStore({ x: { y: 1 } });
    const dep2 = dep1.map('x');
    const mapped = dep2.map('y');

    mapped.set(2);

    expect(dep1.get()).toEqual({ x: { y: 2 } });
    expect(dep2.get()).toEqual({ y: 2 });
    expect(mapped.get()).toEqual(2);
  });

  test('update with function', () => {
    const state = createStore({ x: 1 });
    const mapped = state.map('x');

    mapped.set((x) => x + 1);

    expect(state.get()).toEqual({ x: 2 });
    expect(mapped.get()).toEqual(2);
  });

  test('update revalidates', () => {
    const state = createStore({ x: 1 });
    const mapped = state.map('x');

    mapped.get();
    mapped.set(2);

    expect(state.get()).toEqual({ x: 2 });
    expect(mapped.get()).toEqual(2);
  });

  test('update for non-string selector throws', () => {
    const state = createStore({ x: 1 });
    const mapped = state.map((s) => s.x);

    expect(() => mapped.set(2)).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Can only update computed stores that either are derived from other stores using string selectors or have an updater function.]`,
    );
  });

  test('update for non-string selector with updater', () => {
    const state = createStore({ x: 1 });
    const mapped = state.map(
      (s) => s.x,
      (x) => ({ x }),
    );

    mapped.set((x) => x + 1);

    expect(state.get()).toEqual({ x: 2 });
    expect(mapped.get()).toEqual(2);
  });

  test(`don't make unnecessary recalculation`, () => {
    const expensiveFn = vi.fn((x: number) => x * 2);

    const state = createStore({ numbers: [1, 2, 3] });
    const intermediate = state.map(
      ({ numbers }) => numbers.reduce((acc, x) => acc + x, 0),
      (sum) => ({ numbers: [sum] }),
    );
    const mapped = intermediate.map(expensiveFn);
    const listener = vi.fn(() => undefined);
    mapped.subscribe(listener);

    expect(mapped.get()).toBe(12);
    expect(expensiveFn.mock.calls.length).toBe(1);

    state.set({ numbers: [3, 2, 1] });
    expect(mapped.get()).toBe(12);
    expect(expensiveFn.mock.calls.length).toBe(1);

    intermediate.set(6);
    expect(mapped.get()).toBe(12);
    expect(expensiveFn.mock.calls.length).toBe(1);

    state.set({ numbers: [1, 2, 3, 4] });
    expect(mapped.get()).toBe(20);
    expect(expensiveFn.mock.calls.length).toBe(2);
  });

  test('runNow=false', () => {
    const state = createStore(1);
    const mapped = state.map((x) => x * 2);
    const listener = vi.fn(() => undefined);
    mapped.subscribe(listener, { runNow: false });
    expect(listener.mock.calls.length).toBe(0);
  });

  test(`don't calculate when inactive`, () => {
    const state = createStore(1);
    const calc = vi.fn((x: number) => x * 2);
    const mapped = state.map(calc);

    state.set(2);

    expect(calc.mock.calls.length).toBe(0);
  });
});
