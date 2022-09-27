import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../../src';
import type { ProviderHelpers } from '../../src/core/store';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computed', () => {
  test('create store', () => {
    const state = store(() => 1);

    expect(state).toBeTruthy();
  });

  test('with one depdendency', () => {
    const dep = store(1);
    const state = store(({ use }) => use(dep) + 2);

    expect(state.get()).toBe(3);
  });

  test('with depdendency via this', () => {
    const dep = store(1);
    const state = store(function () {
      return this.use(dep) + 2;
    });

    expect(state.get()).toBe(3);
  });

  test('with multiple depdendencies', () => {
    const dep1 = store(1);
    const dep2 = store(2);
    const state = store(({ use }) => use(dep1) + use(dep2) + 3);

    expect(state.get()).toBe(6);
  });

  test('update on depdendency update', () => {
    const dep1 = store(1);
    const dep2 = store(2);
    const state = store(({ use }) => use(dep1) + use(dep2) + 3);

    const callback = vi.fn();
    state.subscribe(callback);
    expect(callback).toHaveBeenCalledWith(6, undefined);

    dep1.update(4);
    expect(callback).toHaveBeenCalledWith(9, 6);

    dep2.update(5);
    expect(callback).toHaveBeenCalledWith(12, 9);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  describe('selector', () => {
    test('calculate value', async () => {
      const dep = store({ x: 1 });
      const state = store(({ use }) => use(dep, (s) => s.x) + 2);

      expect(state.get()).toBe(3);
    });

    test('update only when selected part changes', async () => {
      const dep = store({ x: 1, y: 2 });
      const calc = vi.fn(({ use }: ProviderHelpers) => use(dep, (s) => s.x) + 2);
      const state = store(calc);
      state.subscribe(() => undefined);

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update({ x: 1, y: 3 });

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update({ x: 2, y: 3 });

      expect(calc).toHaveBeenCalledTimes(2);
    });
  });

  describe('trackingProxy', () => {
    test('calculate value', async () => {
      const dep = store({ x: 1 });
      const state = store(({ use }) => use(dep).x + 2);

      expect(state.get()).toBe(3);
    });

    test('update only when selected part changes', async () => {
      const dep = store({ x: 1, y: 2 });
      const calc = vi.fn(({ use }: ProviderHelpers) => use(dep).x + 2);
      const state = store(calc);
      state.subscribe(() => undefined);

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update({ x: 1, y: 3 });

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update({ x: 2, y: 3 });

      expect(calc).toHaveBeenCalledTimes(2);
    });

    test('disable', async () => {
      const dep = store({ x: 1, y: 2 });
      const calc = vi.fn(({ use }: ProviderHelpers) => use(dep, { disableProxy: true }).x + 2);
      const state = store(calc);
      state.subscribe(() => undefined);
      dep.update({ x: 1, y: 3 });

      expect(calc).toHaveBeenCalledTimes(2);
    });
  });

  describe('lazy computation', () => {
    test('with get', async () => {
      const dep = store(1);
      const calc = vi.fn(({ use }: ProviderHelpers) => use(dep) + 1);
      const state = store(calc);

      expect(calc).toBeCalledTimes(0);

      state.get();
      state.get();

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update(2);

      state.get();
      state.get();

      expect(calc).toHaveBeenCalledTimes(2);
    });

    test('with subscribe', async () => {
      const dep = store(1);
      const calc = vi.fn(({ use }: ProviderHelpers) => use(dep) + 1);
      const state = store(calc);
      state.subscribe(() => undefined);

      expect(calc).toBeCalledTimes(1);

      state.get();
      state.get();

      expect(calc).toHaveBeenCalledTimes(1);

      dep.update(2);

      state.get();
      state.get();

      expect(calc).toHaveBeenCalledTimes(2);
    });
  });
});
