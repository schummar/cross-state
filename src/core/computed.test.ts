import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { atomicStore, computed } from '..';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computed', () => {
  test('create store', () => {
    const store = computed(() => 1);
    expect(store).toBeTruthy();
  });

  test('with one depdendency', () => {
    const dep = atomicStore(1);
    const store = computed((use) => use(dep) + 2);
    expect(store.get()).toBe(3);
  });

  test('with multiple depdendencies', () => {
    const dep1 = atomicStore(1);
    const dep2 = atomicStore(2);
    const store = computed((use) => use(dep1) + use(dep2) + 3);
    expect(store.get()).toBe(6);
  });

  test('update on depdendency update', () => {
    const dep1 = atomicStore(1);
    const dep2 = atomicStore(2);
    const store = computed((use) => use(dep1) + use(dep2) + 3);

    const callback = vi.fn();
    store.subscribe(callback);

    dep1.set(4);
    expect(callback.mock.lastCall).toEqual([9]);

    dep2.set(5);
    expect(callback.mock.lastCall).toEqual([12]);
    expect(callback.mock.calls.length).toBe(3);
  });
});
