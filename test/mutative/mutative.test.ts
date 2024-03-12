import { Store, createStore } from '@core';
import { mutativeMethods } from '@mutative';
import '@patches/register';
import type { Patch } from 'mutative';
import { describe, expect, test } from 'vitest';

describe('mutative methods', () => {
  describe('update', () => {
    test('pass methods explicitly', () => {
      const store = createStore({ a: 1, b: 2 }, { methods: mutativeMethods });

      store.update((draft) => {
        draft.a = 2;
      });

      expect(store.get()).toEqual({ a: 2, b: 2 });
    });

    test('register methods globally', async () => {
      expect(Store.prototype.update).not.toBeDefined();

      await import('@mutative/register');
      expect(Store.prototype.update).toBeDefined();

      const store = createStore({ a: 1, b: 2 });

      store.update((draft) => {
        draft.a = 2;
      });

      expect(store.get()).toEqual({ a: 2, b: 2 });
    });
  });

  test('patches interop', () => {
    const patch: Patch<{ pathAsArray: true }> = { op: 'replace', path: ['a'], value: 2 };
    const store = createStore({ a: 1, b: 2 });
    store.applyPatches(patch);

    expect(store.get()).toEqual({ a: 2, b: 2 });
  });
});
