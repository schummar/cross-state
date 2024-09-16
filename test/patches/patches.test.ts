import { Store, createStore } from '@core';
import { persist, type Patch } from '@index';
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

      let p1: Patch[] | undefined, p2: Patch[] | undefined;
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
      expect(p1![0]).toBe(p2![0]);
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

      using cancel = store1.sync((message) => setTimeout(() => store2.acceptSync(message), 1));

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

    test('sync with multiple consumers', () => {
      const store1 = createStore({ a: 1, b: 2 });
      const store2 = createStore({ a: 0, b: 0 });
      const store3 = createStore({ a: 0, b: 0 });

      using _cancel2 = store1.sync((message) => setTimeout(() => store2.acceptSync(message), 1));

      using _cancel3 = store1.sync((message) => setTimeout(() => store3.acceptSync(message), 1), {
        throttle: { milliseconds: 2 },
      });

      expect(store2.get()).toEqual({ a: 0, b: 0 });
      expect(store3.get()).toEqual({ a: 0, b: 0 });

      vi.advanceTimersByTime(1);
      expect(store2.get()).toEqual({ a: 1, b: 2 });
      expect(store3.get()).toEqual({ a: 1, b: 2 });

      store1.set('a', 2);
      store1.set('a', 3);
      expect(store2.get()).toEqual({ a: 1, b: 2 });
      expect(store3.get()).toEqual({ a: 1, b: 2 });

      vi.advanceTimersByTime(1);
      expect(store2.get()).toEqual({ a: 3, b: 2 });
      expect(store3.get()).toEqual({ a: 1, b: 2 });

      store1.set('a', 4);
      store1.set('b', 5);
      vi.advanceTimersByTime(10);
      expect(store2.get()).toEqual({ a: 4, b: 5 });
      expect(store3.get()).toEqual({ a: 4, b: 5 });
    });

    test('partial sync', () => {
      const store1 = createStore({ a: 1, b: 2 });
      const store2 = createStore({ a: 0, b: 0 });
      const store3 = createStore({ a: 0, b: 0 });

      using _cancel2 = store1.sync((message) => setTimeout(() => store2.acceptSync(message), 1));
      using cancel3 = store1.sync((message) => setTimeout(() => store3.acceptSync(message), 1));

      vi.advanceTimersByTime(1);
      expect(store3.get()).toEqual({ a: 1, b: 2 });

      cancel3();
      store1.set('a', 2);
      store1.set('b', 3);
      vi.advanceTimersByTime(1);

      const callback = vi.fn(store3.acceptSync);
      using _cancel4 = store1.sync((message) => setTimeout(() => callback(message), 1), {
        startAt: store3.version,
      });

      vi.advanceTimersByTime(1);
      store1.set('a', 3);
      vi.advanceTimersByTime(1);

      expect(store3.get()).toEqual({ a: 3, b: 3 });
      expect(callback.mock.calls).toHaveLength(2);
      expect(callback.mock.calls[0]?.[0].patches).toEqual([
        { op: 'replace', path: ['a'], value: 2 },
        { op: 'replace', path: ['b'], value: 3 },
      ]);
      expect(callback.mock.calls[1]?.[0].patches).toEqual([
        { op: 'replace', path: ['a'], value: 3 },
      ]);
    });

    test('partial sync unchanged', () => {
      const store1 = createStore({ a: 1, b: 2 });
      const store2 = createStore({ a: 0, b: 0 });
      using cancel2 = store1.sync((message) => setTimeout(() => store2.acceptSync(message), 1));

      vi.advanceTimersByTime(1);
      expect(store2.get()).toEqual({ a: 1, b: 2 });

      cancel2();
      const callback = vi.fn(store2.acceptSync);
      using cancel3 = store1.sync((message) => setTimeout(() => callback(message), 1), {
        startAt: store2.version,
      });
      vi.advanceTimersByTime(1);

      expect(callback).not.toHaveBeenCalled();
    });

    test('partial sync with persistent storage', async () => {
      const store1 = createStore({ a: 1, b: 2 });
      const store2 = createStore({ a: 0, b: 0 });
      using _persist2 = persist(store2, { id: 'x', storage: localStorage });
      using cancel2 = store1.sync((message) => setTimeout(() => store2.acceptSync(message), 1));

      store1.set('a', 2);
      vi.advanceTimersByTime(1);
      expect(store2.get()).toEqual({ a: 2, b: 2 });

      cancel2();

      store1.set('a', 3);

      const store3 = createStore({ a: 0, b: 0 });
      using persist3 = persist(store3, { id: 'x', storage: localStorage });
      const callback = vi.fn(store3.acceptSync);
      await persist3.initialized;

      store1.sync((message) => setTimeout(() => callback(message), 1), { startAt: store3.version });
      vi.advanceTimersByTime(1);

      expect(store3.get()).toEqual({ a: 3, b: 2 });
      expect(callback.mock.calls).toHaveLength(1);
      expect(callback.mock.calls[0]?.[0].patches).toEqual([
        { op: 'replace', path: ['a'], value: 3 },
      ]);
    });

    test(`sync error when versiosn don't match`, () => {
      const store1 = createStore({ a: 1, b: 2 });
      const store2 = createStore({ a: 0, b: 0 });

      let error: unknown;
      const callback = vi.fn((message) => {
        try {
          store2.acceptSync(message);
        } catch (e) {
          error = e;
        }
      });
      let i = 0;
      using cancel2 = store1.sync((message) =>
        setTimeout(() => {
          if (i++ === 2) return; // drop the second message
          callback(message);
        }, 1),
      );

      store1.set('a', 2);
      store1.set('b', 3);
      store1.set('a', 3);

      vi.advanceTimersByTime(1);
      expect(store2.get()).toEqual({ a: 2, b: 2 });
      expect(error).toBeInstanceOf(Error);
    });
  });
});
