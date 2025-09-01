import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createUrlStore } from '../../src';
import useMockBroadcastChannel from '../mockBroadcastChannel';
import MockStorage from '../mockStorage';

beforeEach(() => {
  useMockBroadcastChannel();
  window.location.href = 'http://localhost';
  window.location.hash = '';
  window.dispatchEvent(new Event('popstate'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.sequential('url store', () => {
  test('createUrlStore', async () => {
    vi.useFakeTimers();

    const state = createUrlStore<string>({ key: 'foo', type: 'hash' });

    window.location.hash = '#foo="bar"';
    window.dispatchEvent(new Event('popstate'));
    expect(state.get()).toEqual('bar');

    state.set('baz');
    expect(window.location.hash).toEqual('#foo=%22bar%22');

    await vi.advanceTimersByTimeAsync(500);
    expect(window.location.hash).toEqual('#foo=%22baz%22');
  });

  test('createUrlStore with defaultValue', async () => {
    vi.useFakeTimers();

    const state = createUrlStore<{ bar: string }>({
      key: 'foo',
      type: 'hash',
      defaultValue: { bar: 'default' },
    });

    expect(state.get()).toEqual({ bar: 'default' });

    state.set({ bar: 'baz' });
    expect(window.location.hash).toEqual('');

    await vi.advanceTimersByTimeAsync(500);
    expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');

    state.set({ bar: 'default' });
    await vi.advanceTimersByTimeAsync(500);
    expect(window.location.hash).toEqual('');
  });

  test('writeDefaultValue=true', async () => {
    vi.useFakeTimers();

    const state = createUrlStore<{ bar: string }>({
      key: 'foo',
      type: 'hash',
      defaultValue: { bar: 'default' },
      writeDefaultValue: true,
    });

    expect(state.get()).toEqual({ bar: 'default' });
    await vi.advanceTimersByTimeAsync(500);
    expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');

    state.set({ bar: 'baz' });
    await vi.advanceTimersByTimeAsync(500);
    expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');

    state.set({ bar: 'default' });
    await vi.advanceTimersByTimeAsync(500);
    expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
  });

  describe('url store persistence', () => {
    test('persists store changes', async () => {
      vi.useFakeTimers();
      const storage = new MockStorage();

      const state = createUrlStore<{ bar: string }>({
        key: 'foo',
        type: 'hash',
        defaultValue: { bar: 'default' },
        writeDefaultValue: true,
        persist: {
          id: 'test',
          storage,
          onlyWhenActive: true,
        },
      });

      using _s = state.subscribe(() => undefined);

      await vi.advanceTimersByTimeAsync(500);
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map());

      state.set({ bar: 'baz' });
      await vi.advanceTimersByTimeAsync(500);
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"baz"']]));

      state.set({ bar: 'default' });
      await vi.advanceTimersByTimeAsync(500);
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"default"']]));
    });

    test('persists url changes while active', async () => {
      vi.useFakeTimers();
      const storage = new MockStorage();

      const state = createUrlStore<{ bar: string }>({
        key: 'foo',
        type: 'hash',
        defaultValue: { bar: 'default' },
        writeDefaultValue: true,
        persist: {
          id: 'test',
          storage,
          onlyWhenActive: true,
        },
      });

      using _s = state.subscribe(() => undefined);

      await vi.advanceTimersByTimeAsync(500);
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map());

      window.location.hash = '#foo=%7B%22bar%22%3A%22baz%22%7D';
      window.dispatchEvent(new Event('popstate'));
      await vi.advanceTimersByTimeAsync(500);
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"baz"']]));
    });

    test(`don't persists url changes while inactive`, async () => {
      vi.useFakeTimers();
      const storage = new MockStorage();

      const _state = createUrlStore<{ bar: string }>({
        key: 'foo',
        type: 'hash',
        defaultValue: { bar: 'default' },
        writeDefaultValue: true,
        persist: {
          id: 'test',
          storage,
          onlyWhenActive: true,
        },
      });

      await vi.advanceTimersByTimeAsync(500);
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map());

      window.location.hash = '#foo=%7B%22bar%22%3A%22baz%22%7D';
      window.dispatchEvent(new Event('popstate'));
      await vi.advanceTimersByTimeAsync(500);
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map());
    });

    test('restores persisted value', async () => {
      vi.useFakeTimers();
      const storage = new MockStorage();
      storage.setItem('test:["bar"]', '"baz"');

      const state = createUrlStore<{ bar: string }>({
        key: 'foo',
        type: 'hash',
        defaultValue: { bar: 'default' },
        writeDefaultValue: true,
        persist: {
          id: 'test',
          storage,
          onlyWhenActive: true,
        },
      });

      using _s = state.subscribe(() => undefined);

      await vi.advanceTimersByTimeAsync(500);
      expect(state.get()).toEqual({ bar: 'baz' });
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"baz"']]));
    });

    test(`doesn't restore persisted value if url is set`, async () => {
      vi.useFakeTimers();
      const storage = new MockStorage();
      storage.setItem('test:["bar"]', '"baz"');

      window.location.href = 'http://localhost/#foo=%7B%22bar%22%3A%22hello%22%7D';
      window.dispatchEvent(new Event('popstate'));

      const state = createUrlStore<{ bar: string }>({
        key: 'foo',
        type: 'hash',
        defaultValue: { bar: 'default' },
        writeDefaultValue: true,
        persist: {
          id: 'test',
          storage,
          onlyWhenActive: true,
        },
      });

      using _s = state.subscribe(() => undefined);

      await vi.advanceTimersByTimeAsync(500);
      expect(state.get()).toEqual({ bar: 'hello' });
      expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22hello%22%7D');
      expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"hello"']]));
    });
  });
});
