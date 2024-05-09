import { Store, createStore } from '@core';
import type { Patch } from '@index';
import { autobind } from '@lib/autobind';
import { patchMethods } from '@patches';
import '@patches/register';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

function register() {
  Object.assign(Store.prototype, patchMethods);
  autobind(Store);
}

function unregister() {
  for (const key in patchMethods) {
    delete (Store.prototype as any)[key];
  }
}

beforeEach((ctx) => {
  vi.useFakeTimers();
  register();
});

afterEach(() => {
  vi.useRealTimers();
  unregister();
});

describe('patch methods', () => {
  describe('register', () => {
    test('pass methods explicitly', () => {
      unregister();
      const store = createStore({ a: 1, b: 2 }, { methods: patchMethods });

      expect(store.subscribePatches).toBeDefined();
      expect(store.applyPatches).toBeDefined();
      expect(store.sync).toBeDefined();
      expect(store.acceptSync).toBeDefined();
    });

    test('register methods globally', () => {
      unregister();
      expect(Store.prototype.subscribePatches).not.toBeDefined();
      expect(Store.prototype.applyPatches).not.toBeDefined();
      expect(Store.prototype.sync).not.toBeDefined();
      expect(Store.prototype.acceptSync).not.toBeDefined();

      register();
      expect(Store.prototype.subscribePatches).toBeDefined();
      expect(Store.prototype.applyPatches).toBeDefined();
      expect(Store.prototype.sync).toBeDefined();
      expect(Store.prototype.acceptSync).toBeDefined();
    });
  });

  describe('subscribePatches', () => {
    test('patches and reversePatches', () => {
      const store = createStore({ a: 1, b: 2 });

      const patches: Patch[] = [];
      const reversePatches: Patch[] = [];

      store.subscribePatches((p, rp) => {
        patches.push(...p);
        reversePatches.push(...rp);
      });

      store.set('a', 2);

      expect(patches).toEqual([{ op: 'replace', path: ['a'], value: 2 }]);
      expect(reversePatches).toEqual([{ op: 'replace', path: ['a'], value: 1 }]);
    });

    test('runNow=true', () => {
      const store = createStore({ a: 1, b: 2 });

      const patches: Patch[] = [];
      const reversePatches: Patch[] = [];

      store.subscribePatches(
        (p, rp) => {
          patches.push(...p);
          reversePatches.push(...rp);
        },
        { runNow: true },
      );

      store.set('a', 2);

      expect(patches).toEqual([
        { op: 'replace', path: [], value: { a: 1, b: 2 } },
        { op: 'replace', path: ['a'], value: 2 },
      ]);
      expect(reversePatches).toEqual([
        { op: 'replace', path: [], value: undefined },
        { op: 'replace', path: ['a'], value: 1 },
      ]);
    });

    test('patches are only calculated once', () => {
      const store = createStore({ a: 1, b: 2 });

      let p1, p2;
      store.subscribePatches((p) => {
        p1 = p;
      });
      store.subscribePatches(
        (p) => {
          p2 = p;
        },
        { debounce: { milliseconds: 1 } },
      );

      store.set('a', 2);
      vi.advanceTimersByTime(1);

      expect(p1).toEqual([{ op: 'replace', path: ['a'], value: 2 }]);
      expect(p2).toBe(p1);
    });
  });

  describe('applyPatches', () => {
    test('apply patches', () => {
      const store = createStore({ a: 1, b: 2 });

      store.applyPatches({ op: 'replace', path: ['a'], value: 2 });

      expect(store.get()).toEqual({ a: 2, b: 2 });
    });
  });

  describe('sync', () => {
    test('sync patches', () => {
      const store1 = createStore({ a: 1, b: 2 });
      const store2 = createStore({ a: 0, b: 0 });

      const accept = store2.acceptSync();
      const cancel = store1.sync((message) => setTimeout(() => accept(message), 1));

      expect(store2.get()).toEqual({ a: 0, b: 0 });

      vi.advanceTimersByTime(1);
      expect(store2.get()).toEqual({ a: 1, b: 2 });

      store1.set('a', 2);
      expect(store2.get()).toEqual({ a: 1, b: 2 });

      vi.advanceTimersByTime(1);
      expect(store2.get()).toEqual({ a: 2, b: 2 });

      cancel();
      store1.set('a', 3);
      vi.advanceTimersByTime(1);
      expect(store2.get()).toEqual({ a: 2, b: 2 });
    });
  });
});
