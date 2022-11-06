import { describe, expect, test } from 'vitest';
import { store } from '../../src';

describe.skip('store actions', () => {
  test('map store', () => {
    const state = store(new Map<number, number>());
    state.set(1, 2);
    state.set(3, 4);
    state.delete(1);
    expect(state.get()).toEqual(new Map([[3, 4]]));
    state.clear();
    expect(state.get()).toEqual(new Map());
  });

  test('record store', () => {
    const state = store({} as Record<number, number>);
    state.set(1, 2);
    state.set(3, 4);
    state.delete(1);
    expect(state.get()).toEqual({ 3: 4 });
    state.clear();
    expect(state.get()).toEqual({});
  });

  test('set store', () => {
    const state = store(new Set<number>());
    state.add(1);
    state.add(2);
    state.delete(1);
    expect(state.get()).toEqual(new Set([2]));
    state.clear();
    expect(state.get()).toEqual(new Set());
  });

  test('array store', () => {
    const state = store<number[]>([]);

    expect(state.push(1, 2, 3)).toBe(3);
    expect(state.get()).toEqual([1, 2, 3]);

    expect(state.splice(1, 1)).toEqual([2]);
    expect(state.get()).toEqual([1, 3]);

    expect(state.pop()).toBe(3);
    expect(state.get()).toEqual([1]);

    expect(state.unshift(4)).toBe(2);
    expect(state.get()).toEqual([4, 1]);

    expect(state.shift()).toBe(4);
    expect(state.get()).toEqual([1]);
  });
});
