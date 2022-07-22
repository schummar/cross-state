import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ComputedUse } from '../../src';
import { atomicStore, computed } from '../../src';

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
    expect(callback).toHaveBeenCalledWith(6, undefined);

    dep1.update(4);
    expect(callback).toHaveBeenCalledWith(9, 6);

    dep2.update(5);
    expect(callback).toHaveBeenCalledWith(12, 9);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  describe('selector', () => {
    test('calculate value', async () => {
      const dep = atomicStore({ x: 1 });
      const store = computed((use) => use(dep, (s) => s.x) + 2);

      expect(store.get()).toBe(3);
    });

    test('update only when selected part changes', async () => {
      const dep = atomicStore({ x: 1, y: 2 });
      const calc = vi.fn((use: ComputedUse) => use(dep, (s) => s.x) + 2);
      const store = computed(calc);
      store.subscribe(() => undefined);

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update({ x: 1, y: 3 });

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update({ x: 2, y: 3 });

      expect(calc).toHaveBeenCalledTimes(2);
    });
  });

  describe('trackingProxy', () => {
    test('calculate value', async () => {
      const dep = atomicStore({ x: 1 });
      const store = computed((use) => use(dep).x + 2);

      expect(store.get()).toBe(3);
    });

    test('update only when selected part changes', async () => {
      const dep = atomicStore({ x: 1, y: 2 });
      const calc = vi.fn((use: ComputedUse) => use(dep).x + 2);
      const store = computed(calc);
      store.subscribe(() => undefined);

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update({ x: 1, y: 3 });

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update({ x: 2, y: 3 });

      expect(calc).toHaveBeenCalledTimes(2);
    });

    test('disable', async () => {
      const dep = atomicStore({ x: 1, y: 2 });
      const calc = vi.fn((use: ComputedUse) => use(dep).x + 2);
      const store = computed(calc, { disableProxy: true });
      store.subscribe(() => undefined);
      dep.update({ x: 1, y: 3 });

      expect(calc).toHaveBeenCalledTimes(2);
    });
  });

  describe('lazy computation', () => {
    test('with get', async () => {
      const dep = atomicStore(1);
      const calc = vi.fn((use: ComputedUse) => use(dep) + 1);
      const store = computed(calc);

      expect(calc).toBeCalledTimes(0);

      store.get();
      store.get();

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update(2);

      store.get();
      store.get();

      expect(calc).toHaveBeenCalledTimes(2);
    });

    test('with subscribe', async () => {
      const dep = atomicStore(1);
      const calc = vi.fn((use: ComputedUse) => use(dep) + 1);
      const store = computed(calc);
      store.subscribe(() => undefined);

      expect(calc).toBeCalledTimes(1);

      store.get();
      store.get();

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update(2);

      store.get();
      store.get();

      expect(calc).toHaveBeenCalledTimes(2);
    });
  });
});
