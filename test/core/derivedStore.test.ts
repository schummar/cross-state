import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { derivedStore, store } from '../../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('derived store', () => {
  test('create', () => {
    const state = derivedStore(() => 1);
    expect(state).toBeTruthy();
  });

  test('get', () => {
    const dep = store(1);
    const derived = derivedStore(({ use }) => {
      return use(dep) * 2;
    });

    expect(derived.get()).toBe(2);
  });
});
