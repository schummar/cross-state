import { beforeEach, describe, expect, test, vi } from 'vitest';
import { connectUrl, createStore, createUrlStore } from '../../src';

beforeEach(() => {
  window.location.href = 'about:blank';
  window.location.hash = '';
  window.dispatchEvent(new Event('popstate'));

  window.history.replaceState = (_x: any, _y: any, url: string) => {
    window.location.href = url;
  };
});

describe('url store', () => {
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

  test('createUrlStore with defaultValue and writeDefaultValue=true', async () => {
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

  test('connectUrl1', async () => {
    const store = createStore<string>('initial');
    connectUrl(store, { key: 'foo', defaultValue: 'bar' });

    expect(store.get()).toEqual('bar');
  });

  test('connectUrl2', async () => {
    const store = createStore<string | undefined>('initial');
    connectUrl(store, { key: 'foo' });

    expect(store.get()).toBeUndefined();
  });
});
