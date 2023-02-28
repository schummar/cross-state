import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('derived store', () => {
  test('create', () => {
    const state = store(() => 1);
    expect(state).toBeTruthy();
  });

  test('get', () => {
    const dep = store(1);
    const derived = store(({ use }) => {
      return use(dep) * 2;
    });

    expect(derived.get()).toBe(2);
  });

  test('update throws', () => {
    const dep = store(1);
    const derived = store(({ use }) => {
      return use(dep) * 2;
    });

    expect(() => derived.set(1)).toThrow(
      'Can only updated computed stores that are derived from other stores using string selectors',
    );
  });
});
