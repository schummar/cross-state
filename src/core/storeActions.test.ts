import { describe, expect, test } from 'vitest';
import { atomicStore } from './atomicStore';
import { recordActions } from './storeActions';

describe('store actions', () => {
  test('map store', () => {
    const x = atomicStore(new Map<number, number>());
    x.with(1, 2);
    x.with(3, 4);
    x.without(1);
    expect(x.get()).toEqual(new Map([[3, 4]]));
    x.clear();
    expect(x.get()).toEqual(new Map());
  });

  test('record store', () => {
    const x = atomicStore({} as Record<number, number>, recordActions);
    x.with(1, 2);
    x.with(3, 4);
    x.without(1);
    expect(x.get()).toEqual({ 3: 4 });
    x.clear();
    expect(x.get()).toEqual({});
  });

  test('set store', () => {
    const x = atomicStore(new Set<number>());
    x.add(1);
    x.add(2);
    x.delete(1);
    expect(x.get()).toEqual(new Set([2]));
    x.clear();
    expect(x.get()).toEqual(new Set());
  });

  test('array store', () => {
    const x = atomicStore<number[]>([]);

    expect(x.push(1, 2, 3)).toBe(3);
    expect(x.get()).toEqual([1, 2, 3]);

    expect(x.splice(1, 1)).toEqual([2]);
    expect(x.get()).toEqual([1, 3]);

    expect(x.pop()).toBe(3);
    expect(x.get()).toEqual([1]);

    expect(x.unshift(4)).toBe(2);
    expect(x.get()).toEqual([4, 1]);

    expect(x.shift()).toBe(4);
    expect(x.get()).toEqual([1]);
  });
});
