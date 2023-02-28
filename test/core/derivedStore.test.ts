import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('derived store', () => {
  test('create', () => {
    const state = createStore(() => 1);
    expect(state).toBeTruthy();
  });

  test('get', () => {
    const dep = createStore(1);
    const derived = createStore(({ use }) => {
      return use(dep) * 2;
    });

    expect(derived.get()).toBe(2);
  });

  test('update throws', () => {
    const dep = createStore(1);
    const derived = createStore(({ use }) => {
      return use(dep) * 2;
    });

    expect(() => derived.set(1)).toThrow(
      'Can only updated computed stores that are derived from other stores using string selectors',
    );
  });
});
