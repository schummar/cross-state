// eslint-disable-next-line max-classes-per-file
import { createStore } from '@core';
import '@patches/register';
import { persist, type PersistStorageWithKeys, type PersistStorageWithLength } from '@persist';
import { split } from '@persist/persistPathHelpers';
import seedrandom from 'seedrandom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, sleep } from '../testHelpers';

beforeEach(() => {
  vi.useFakeTimers();

  const broadcastChannelInstances: any[] = [];

  vi.stubGlobal(
    'BroadcastChannel',
    class {
      listener: any;

      constructor() {
        broadcastChannelInstances.push(this);
      }

      addEventListener(_event: string, listener: any) {
        this.listener = listener;
      }

      removeEventListener() {
        this.listener = undefined;
      }

      async postMessage(message: any) {
        for (const channel of broadcastChannelInstances) {
          if (channel === this) continue;
          await sleep(1);
          channel.listener?.({ data: message });
        }
      }

      close() {
        this.listener = undefined;
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

class MockStorage implements PersistStorageWithKeys {
  items = new Map<string, string>();

  constructor(
    public readonly delay?: { get?: number; set?: number; remove?: number; keys?: number },
  ) {}

  withDelay<T>(method: 'get' | 'set' | 'remove' | 'keys', action: () => T) {
    if (this.delay?.[method]) {
      return sleep(this.delay[method]!).then(action);
    }

    return action();
  }

  getItem(key: string) {
    return this.withDelay('get', () => this.items.get(key) ?? null);
  }

  setItem(key: string, value: string) {
    return this.withDelay('set', () => {
      this.items.set(key, value);
    });
  }

  removeItem(key: string) {
    return this.withDelay('remove', () => {
      this.items.delete(key);
    });
  }

  keys() {
    return this.withDelay('keys', () => {
      return [...this.items.keys()];
    });
  }

  get itemsWithoutVersion() {
    return new Map([...this.items].filter(([key]) => !key.startsWith('test:version')));
  }
}

describe('persist', () => {
  test('initialize', async () => {
    const storage = new MockStorage();
    const s1 = createStore({ a: 1 });
    persist(s1, {
      id: 'test',
      storage,
    });

    expect(storage.items.size).toBe(0);
  });

  test('wait initialized', async () => {
    vi.useRealTimers();
    const storage = new MockStorage({ keys: 1, get: 1 });
    storage.items.set('test:["a"]', '1');
    const s1 = createStore({ a: 0 });
    const p = persist(s1, {
      id: 'test',
      storage,
    });

    expect(s1.get()).toStrictEqual({ a: 0 });

    await p.initialized;
    expect(s1.get()).toStrictEqual({ a: 1 });
  });

  describe('save', () => {
    test('save all', async () => {
      const storage = new MockStorage();
      const s1 = createStore({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.set({ a: { b: 2 } });

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map([['test:["a"]', '{"b":2}']]));
    });

    test('save extended json', async () => {
      const storage = new MockStorage();
      const s1 = createStore(new Map());
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.set(
        new Map<any, any>([
          ['a', new Map([['a', 1]])],
          ['b', new Set([2])],
          ['c', new Date(0)],
        ]),
      );

      expect(storage.itemsWithoutVersion).toStrictEqual(
        new Map([
          ['test:["a"]', '{"__map":[["a",1]]}'],
          ['test:["b"]', '{"__set":[2]}'],
          ['test:["c"]', '{"__date":"1970-01-01T00:00:00.000Z"}'],
        ]),
      );
    });

    test('save path', async () => {
      const storage = new MockStorage();
      const s1 = createStore({ a: 1, b: 2, c: 3 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [['a'], ['c']],
      });

      s1.set({ a: 4, b: 5, c: 6 });

      expect(storage.itemsWithoutVersion).toStrictEqual(
        new Map([
          ['test:["a"]', '4'],
          ['test:["c"]', '6'],
        ]),
      );
    });

    test('save wildcard path', async () => {
      const storage = new MockStorage();
      const s1 = createStore({ a: { x: 1, y: 2, z: 3 } });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      s1.set({ a: { x: 4, y: 2, z: 5 } });

      expect(storage.itemsWithoutVersion).toStrictEqual(
        new Map([
          ['test:["a","x"]', '4'],
          ['test:["a","z"]', '5'],
        ]),
      );
    });

    test('save wildcard path with array', async () => {
      const storage = new MockStorage();
      const s1 = createStore({ a: [1, 2, 3] });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      s1.set({ a: [1, 4, 3] });

      expect(storage.itemsWithoutVersion).toStrictEqual(
        new Map([
          ['test:["a",0]', '1'],
          ['test:["a",1]', '4'],
          ['test:["a",2]', '3'],
        ]),
      );
    });

    test('save wildcard path with map', async () => {
      const storage = new MockStorage();
      const s1 = createStore({
        a: new Map([
          ['x', 1],
          ['y', 2],
          ['z', 3],
        ]),
      });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      s1.set({
        a: new Map([
          ['x', 4],
          ['y', 2],
          ['z', 5],
        ]),
      });

      expect(storage.itemsWithoutVersion).toStrictEqual(
        new Map([
          ['test:["a","x"]', '4'],
          ['test:["a","z"]', '5'],
        ]),
      );
    });

    test('save wildcard path with set', async () => {
      const storage = new MockStorage();
      const s1 = createStore({
        a: new Set([1, 2, 3]),
      });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      s1.set({
        a: new Set([1, 4, 3]),
      });

      expect(storage.itemsWithoutVersion).toStrictEqual(
        new Map([
          ['test:["a",0]', '1'],
          ['test:["a",1]', '4'],
          ['test:["a",2]', '3'],
        ]),
      );
    });

    test('setting undefined', async () => {
      const storage = new MockStorage();
      const s1 = createStore<any>({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.set({ a: undefined });

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map());
    });

    test('save removal', async () => {
      const storage = new MockStorage();
      const s1 = createStore<any>({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.set({});

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map());
    });

    test('save primitive', async () => {
      const storage = new MockStorage();
      const s1 = createStore(1);
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.set(2);

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map([['test:[]', '2']]));
    });
  });

  describe('load', () => {
    test('load all', async () => {
      const storage = new MockStorage();
      storage.items.set('test:["a"]', '{"b":2}');

      const s1 = createStore({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      expect(s1.get()).toStrictEqual({ a: { b: 2 } });
    });

    test('load path', async () => {
      const storage = new MockStorage();
      storage.items.set('test:["a"]', '4');
      storage.items.set('test:["c"]', '6');

      const s1 = createStore({ a: 1, b: 2, c: 3 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [['a'], ['c']],
      });

      expect(s1.get()).toStrictEqual({ a: 4, b: 2, c: 6 });
    });

    test('load wildcard path', async () => {
      const storage = new MockStorage();
      storage.items.set('test:["a","x"]', '4');
      storage.items.set('test:["a","z"]', '5');

      const s1 = createStore({ a: { x: 1, y: 2, z: 3 } });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      expect(s1.get()).toStrictEqual({ a: { x: 4, y: 2, z: 5 } });
    });

    test(`doesn't load item whose path is not persisted anymore`, () => {
      const storage = new MockStorage();
      storage.items.set('test:["a"]', '3');
      storage.items.set('test:["b"]', '4');

      const s1 = createStore({ a: 1, b: 2 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [['a']],
      });

      expect(s1.get()).toStrictEqual({ a: 3, b: 2 });
    });

    test('load removal', async () => {
      const storage = new MockStorage();
      storage.items.set('test:["a"]', 'undefined');

      const s1 = createStore<any>({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      expect(s1.get()).toStrictEqual({});
    });

    test('load primitive', async () => {
      const storage = new MockStorage();
      storage.items.set('test:[]', '2');

      const s1 = createStore(1);
      using p = persist(s1, {
        id: 'test',
        storage,
      });
      await p.initialized;

      expect(s1.get()).toBe(2);
    });
  });

  describe('change something wile loading', () => {
    test('changed same path', async () => {
      const storage = new MockStorage({ get: 1 });
      storage.items.set('test:["a"]', '2');

      const s1 = createStore({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.set({ a: 3 });
      vi.runAllTimers();
      await flushPromises();

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map([['test:["a"]', '3']]));
      expect(s1.get()).toStrictEqual({ a: 3 });
    });

    test('changed ancestor path', async () => {
      const storage = new MockStorage({ get: 1 });
      storage.items.set('test:["a"]', '2');

      const s1 = createStore<any>({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [[], ['a']],
      });

      s1.set({ b: 3 });
      vi.runAllTimers();
      await flushPromises();

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map([['test:[]', '{"b":3}']]));
      expect(s1.get()).toStrictEqual({ b: 3 });
    });

    test('changed descendant path', async () => {
      const storage = new MockStorage({ get: 1 });
      storage.items.set('test:[]', '{"a":2}');

      const s1 = createStore({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [[], ['a']],
      });

      s1.set({ a: 3 });
      vi.runAllTimers();
      await flushPromises();

      expect(storage.itemsWithoutVersion).toStrictEqual(
        new Map([
          ['test:[]', '{"a":3}'],
          ['test:["a"]', '3'],
        ]),
      );
      expect(s1.get()).toStrictEqual({ a: 3 });
    });
  });

  describe('storage types', () => {
    test('PersistStorageWithLength', async () => {
      const storage: PersistStorageWithLength = {
        getItem: (key) => key.match(/(\d+)/)?.[1] ?? '',
        setItem: () => undefined,
        removeItem: () => undefined,
        length: 3,
        key: (index) => `test:["${index}"]`,
      };

      const store = createStore({});
      await persist(store, { id: 'test', storage }).initialized;
      await flushPromises();

      expect(store.get()).toStrictEqual({ '0': 0, '1': 1, '2': 2 });
    });
  });

  describe('sync', () => {
    test('sync changes across tabs', async () => {
      const storage = new MockStorage();

      const s1 = createStore({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
      });

      const s2 = createStore({ a: 1 });
      persist(s2, {
        id: 'test',
        storage,
      });

      s1.set({ a: 2 });

      expect(s2.get()).toStrictEqual({ a: 1 });

      vi.runAllTimers();
      await flushPromises();

      expect(s2.get()).toStrictEqual({ a: 2 });
    });

    test('sync avoids conflicts', async () => {
      const storage = new MockStorage({ keys: 1, get: 1, set: 1, remove: 1 });

      const s1 = createStore({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
      });

      const s2 = createStore({ a: 1 });
      persist(s2, {
        id: 'test',
        storage,
      });

      s1.set({ a: 2 });
      s2.set({ a: 3 });

      expect(s1.get()).toStrictEqual({ a: 2 });
      expect(s2.get()).toStrictEqual({ a: 3 });
      expect(storage.items).toStrictEqual(new Map());

      vi.runAllTimers();
      await flushPromises();

      expect(s1.get()).toStrictEqual({ a: 2 });
      expect(s2.get()).toStrictEqual({ a: 3 });
      expect(storage.items).toStrictEqual(new Map([[`test:["a"]`, '3']]));

      vi.runAllTimers();
      await flushPromises();
      vi.runAllTimers();
      await flushPromises();
      vi.runAllTimers();
      await flushPromises();

      expect(s1.get()).toStrictEqual({ a: 3 });
      expect(s2.get()).toStrictEqual({ a: 3 });
      expect(storage.itemsWithoutVersion).toStrictEqual(new Map([[`test:["a"]`, '3']]));
    });

    test.skip('sync avoids conflicts when updating ancestors or descendants', async () => {
      const storage = new MockStorage({ keys: 1, get: 1, set: 1, remove: 1 });

      const s1 = createStore({ a: { b: 1, c: 1 }, d: 1 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [[], ['a'], ['a', 'b']],
      });

      const s2 = createStore({ a: { b: 1, c: 1 }, d: 1 });
      persist(s2, {
        id: 'test',
        storage,
        paths: [[], ['a'], ['a', 'b']],
      });

      const s3 = createStore({ a: { b: 1, c: 1 }, d: 1 });
      persist(s3, {
        id: 'test',
        storage,
        paths: [[], ['a'], ['a', 'b']],
      });

      s1.set(['a', 'b'], 2);
      s2.set(['a', 'c'], 2);
      s3.set(['d'], 2);

      for (let i = 0; i < 100; i++) {
        vi.runAllTimers();
        await flushPromises();
      }

      expect(s1.get()).toStrictEqual({ a: { b: 2, c: 1 }, d: 1 });
      expect(s2.get()).toStrictEqual({ a: { b: 1, c: 2 }, d: 1 });
      expect(s3.get()).toStrictEqual({ a: { b: 1, c: 1 }, d: 2 });
      expect(storage.items).toStrictEqual(new Map());
    });

    test('sync avoids conflicts chaos test', async () => {
      const numberStores = 10;
      const numberUpdates = 1000;

      const storage = new MockStorage({ keys: 1, get: 1, set: 1, remove: 1 });

      const stores = Array.from({ length: numberStores }, () => {
        const store = createStore({ x: 1 });

        persist(store, {
          id: 'test',
          storage,
        });

        return store;
      });

      const rand = seedrandom('seed');

      for (let i = 0; i < numberUpdates; i++) {
        const store = stores[Math.abs(rand.int32()) % stores.length];
        store?.set({ x: Math.abs(rand.int32()) % 1000 });

        vi.advanceTimersByTime(Math.abs(rand.int32()) % 10);
        await flushPromises();
      }

      for (let i = 0; i < numberUpdates; i++) {
        vi.runAllTimers();
        await flushPromises();
      }

      const values = stores.map((s) => s.get().x);
      expect(values).toStrictEqual(Array.from({ length: stores.length }, () => values[0]));
    });

    test('throttle', async () => {
      const storage = new MockStorage();
      const s1 = createStore({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
        throttle: { milliseconds: 1 },
      });

      s1.set({ a: 2 });

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map([['test:["a"]', '2']]));

      s1.set({ a: 3 });

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map([['test:["a"]', '2']]));

      vi.advanceTimersByTime(1);
      await flushPromises();

      expect(storage.itemsWithoutVersion).toStrictEqual(new Map([['test:["a"]', '3']]));
    });

    describe('split', () => {
      test('length=1', () => {
        const x = split({ a: 1, b: 2 }, ['a']);
        expect(x).toStrictEqual([{ path: ['a'], value: 1 }]);
      });

      test('length=1 with wildcard', () => {
        const x = split({ a: 1, b: 2 }, ['*']);
        expect(x).toStrictEqual([
          { path: ['a'], value: 1 },
          { path: ['b'], value: 2 },
        ]);
      });

      test('length=2', () => {
        const x = split({ a: { b: 1, c: 2 }, d: 3 }, ['a', 'b']);
        expect(x).toStrictEqual([{ path: ['a', 'b'], value: 1 }]);
      });

      test('length=2 with wildcard', () => {
        const x = split({ a: { b: 1, c: 2 }, d: 3 }, ['a', '*']);
        expect(x).toStrictEqual([
          { path: ['a', 'b'], value: 1 },
          { path: ['a', 'c'], value: 2 },
        ]);
      });
    });

    test('version is persisted', async () => {
      const store = createStore({ a: 1, b: 2 });
      const storage = new MockStorage();
      using _persist1 = persist(store, { id: 'x', storage });

      store.acceptSync({ toVersion: 'v1', patches: [{ op: 'replace', path: ['a'], value: 3 }] });

      expect(storage.items).toEqual(
        new Map([
          ['x:["a"]', '3'],
          ['x:version', 'v1'],
        ]),
      );
    });
  });
});
