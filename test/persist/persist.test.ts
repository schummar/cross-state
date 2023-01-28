// eslint-disable-next-line max-classes-per-file
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { store } from '../../src';
import { maybeAsync } from '../../src/lib/maybeAsync';
import type { PersistStorageWithKeys } from '../../src/persist';
import { persist } from '../../src/persist';
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
    return maybeAsync(this.delay?.[method] ? sleep(this.delay[method]!) : undefined, action);
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
}

describe('persist', () => {
  test('initialize', async () => {
    const storage = new MockStorage();
    const s1 = store({ a: 1 });
    persist(s1, {
      id: 'test',
      storage,
    });

    expect(storage.items.size).toBe(0);
  });

  describe('save', () => {
    test('save all', async () => {
      const storage = new MockStorage();
      const s1 = store({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.update({ a: { b: 2 } });

      expect(storage.items).toStrictEqual(new Map([['["a"]', '{"b":2}']]));
    });

    test('save path', async () => {
      const storage = new MockStorage();
      const s1 = store({ a: 1, b: 2, c: 3 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [['a'], ['c']],
      });

      s1.update({ a: 4, b: 5, c: 6 });

      expect(storage.items).toStrictEqual(
        new Map([
          ['["a"]', '4'],
          ['["c"]', '6'],
        ]),
      );
    });

    test('save wildcard path', async () => {
      const storage = new MockStorage();
      const s1 = store({ a: { x: 1, y: 2, z: 3 } });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      s1.update({ a: { x: 4, y: 2, z: 5 } });

      expect(storage.items).toStrictEqual(
        new Map([
          ['["a","x"]', '4'],
          ['["a","z"]', '5'],
        ]),
      );
    });

    test('save wildcard path with array', async () => {
      const storage = new MockStorage();
      const s1 = store({ a: [1, 2, 3] });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      s1.update({ a: [1, 4, 3] });

      expect(storage.items).toStrictEqual(new Map([['["a",1]', '4']]));
    });

    test('save wildcard path with map', async () => {
      const storage = new MockStorage();
      const s1 = store({
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

      s1.update({
        a: new Map([
          ['x', 4],
          ['y', 2],
          ['z', 5],
        ]),
      });

      expect(storage.items).toStrictEqual(
        new Map([
          ['["a","x"]', '4'],
          ['["a","z"]', '5'],
        ]),
      );
    });

    test('save wildcard path with set', async () => {
      const storage = new MockStorage();
      const s1 = store({
        a: new Set([1, 2, 3]),
      });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      s1.update({
        a: new Set([1, 4, 3]),
      });

      expect(storage.items).toStrictEqual(new Map([['["a",1]', '4']]));
    });

    test('save removal', async () => {
      const storage = new MockStorage();
      const s1 = store<any>({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.update({});

      expect(storage.items).toStrictEqual(new Map([['["a"]', 'undefined']]));
    });
  });

  describe('load', () => {
    test('load all', async () => {
      const storage = new MockStorage();
      storage.items.set('["a"]', '{"b":2}');

      const s1 = store({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      expect(s1.get()).toStrictEqual({ a: { b: 2 } });
    });

    test('load path', async () => {
      const storage = new MockStorage();
      storage.items.set('["a"]', '4');
      storage.items.set('["c"]', '6');

      const s1 = store({ a: 1, b: 2, c: 3 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [['a'], ['c']],
      });

      expect(s1.get()).toStrictEqual({ a: 4, b: 2, c: 6 });
    });

    test('load wildcard path', async () => {
      const storage = new MockStorage();
      storage.items.set('["a","x"]', '4');
      storage.items.set('["a","z"]', '5');

      const s1 = store({ a: { x: 1, y: 2, z: 3 } });
      persist(s1, {
        id: 'test',
        storage,
        paths: ['a.*'],
      });

      expect(s1.get()).toStrictEqual({ a: { x: 4, y: 2, z: 5 } });
    });

    test(`doesn't load item whose path is not persisted anymore`, () => {
      const storage = new MockStorage();
      storage.items.set('["a"]', '3');
      storage.items.set('["b"]', '4');

      const s1 = store({ a: 1, b: 2 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [['a']],
      });

      expect(s1.get()).toStrictEqual({ a: 3, b: 2 });
    });

    test('load removal', async () => {
      const storage = new MockStorage();
      storage.items.set('["a"]', 'undefined');

      const s1 = store<any>({ a: { b: 1 } });
      persist(s1, {
        id: 'test',
        storage,
      });

      expect(s1.get()).toStrictEqual({ a: undefined });
    });
  });

  describe('change something wile loading', () => {
    test('changed same path', async () => {
      const storage = new MockStorage({ get: 1 });
      storage.items.set('["a"]', '2');

      const s1 = store({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
      });

      s1.update({ a: 3 });
      vi.runAllTimers();
      await flushPromises();

      expect(storage.items).toStrictEqual(new Map([['["a"]', '3']]));
      expect(s1.get()).toStrictEqual({ a: 3 });
    });

    test('changed ancestor path', async () => {
      const storage = new MockStorage({ get: 1 });
      storage.items.set('["a"]', '2');

      const s1 = store<any>({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [[], ['a']],
      });

      s1.update({ b: 3 });
      vi.runAllTimers();
      await flushPromises();

      expect(storage.items).toStrictEqual(new Map([['[]', '{"b":3}']]));
      expect(s1.get()).toStrictEqual({ b: 3 });
    });

    test('changed descendant path', async () => {
      const storage = new MockStorage({ get: 1 });
      storage.items.set('[]', '{"a":2}');

      const s1 = store({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
        paths: [[], ['a']],
      });

      s1.update({ a: 3 });
      vi.runAllTimers();
      await flushPromises();

      expect(storage.items).toStrictEqual(
        new Map([
          ['[]', '{"a":2}'],
          ['["a"]', '3'],
        ]),
      );
      expect(s1.get()).toStrictEqual({ a: 3 });
    });
  });

  describe('sync', () => {
    test('sync changes across tabs', async () => {
      const storage = new MockStorage();

      const s1 = store({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
      });

      const s2 = store({ a: 1 });
      persist(s2, {
        id: 'test',
        storage,
      });

      s1.update({ a: 2 });

      expect(s2.get()).toStrictEqual({ a: 1 });

      vi.runAllTimers();
      await flushPromises();

      expect(s2.get()).toStrictEqual({ a: 2 });
    });

    test('sync avoids conflicts', async () => {
      const storage = new MockStorage({ keys: 1, get: 1, set: 1, remove: 1 });

      const s1 = store({ a: 1 });
      persist(s1, {
        id: 'test',
        storage,
      });

      const s2 = store({ a: 1 });
      persist(s2, {
        id: 'test',
        storage,
      });

      s1.update({ a: 2 });
      s2.update({ a: 3 });

      expect(s1.get()).toStrictEqual({ a: 2 });
      expect(s2.get()).toStrictEqual({ a: 3 });
      expect(storage.items).toStrictEqual(new Map());

      vi.runAllTimers();
      await flushPromises();

      expect(s1.get()).toStrictEqual({ a: 2 });
      expect(s2.get()).toStrictEqual({ a: 3 });
      expect(storage.items).toStrictEqual(new Map([[`["a"]`, '3']]));

      vi.runAllTimers();
      await flushPromises();
      vi.runAllTimers();
      await flushPromises();

      expect(s1.get()).toStrictEqual({ a: 3 });
      expect(s2.get()).toStrictEqual({ a: 3 });
      expect(storage.items).toStrictEqual(new Map([[`["a"]`, '3']]));
    });
  });
});
