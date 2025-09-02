import { createStore } from '@core';
import { UrlProvider, useStore, useUrlParam } from '@react';
import { renderHook } from '@testing-library/react';
import { act, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const urlStore = createStore('/');

beforeEach(() => {
  urlStore.set('/');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <UrlProvider
    locationHook={() => useStore(urlStore)}
    navigate={(nav) => {
      const newUrl = nav(encodeURI(urlStore.get()));
      urlStore.set(decodeURI(newUrl));
    }}
  >
    {children}
  </UrlProvider>
);

describe('url store', () => {
  test('createUrlStore', async () => {
    const { result } = renderHook(() => useUrlParam<string>({ key: 'foo', type: 'hash' }), {
      wrapper,
    });

    act(() => urlStore.set('/#foo="bar"'));
    expect(result.current[0]).toBe('bar');

    result.current[1]('baz');
    expect(urlStore.get()).toEqual('/#foo="bar"');

    await vi.advanceTimersByTimeAsync(500);
    expect(urlStore.get()).toEqual('/#foo="baz"');
  });

  test('createUrlStore without defaultValue', async () => {
    const { result } = renderHook(
      () =>
        useUrlParam({
          key: 'foo',
          type: 'hash',
          defaultValue: { bar: 'default' },
        }),
      { wrapper },
    );

    expect(result.current[0]).toEqual({ bar: 'default' });

    act(() => result.current[1]({ bar: 'baz' }));
    expect(result.current[0]).toEqual({ bar: 'baz' });

    await vi.advanceTimersByTimeAsync(500);
    expect(urlStore.get()).toBe('/#foo={"bar"%3A"baz"}');
  });

  // test('createUrlStore with defaultValue', async () => {
  //   vi.useFakeTimers();

  //   const state = createUrlStore<{ bar: string }>({
  //     key: 'foo',
  //     type: 'hash',
  //     defaultValue: { bar: 'default' },
  //   });

  //   expect(state.get()).toEqual({ bar: 'default' });

  //   state.set({ bar: 'baz' });
  //   expect(window.location.hash).toEqual('');

  //   await vi.advanceTimersByTimeAsync(500);
  //   expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');

  //   state.set({ bar: 'default' });
  //   await vi.advanceTimersByTimeAsync(500);
  //   expect(window.location.hash).toEqual('');
  // });

  // test('writeDefaultValue=true', async () => {
  //   vi.useFakeTimers();

  //   const state = createUrlStore<{ bar: string }>({
  //     key: 'foo',
  //     type: 'hash',
  //     defaultValue: { bar: 'default' },
  //     writeDefaultValue: true,
  //   });

  //   expect(state.get()).toEqual({ bar: 'default' });
  //   await vi.advanceTimersByTimeAsync(500);
  //   expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');

  //   state.set({ bar: 'baz' });
  //   await vi.advanceTimersByTimeAsync(500);
  //   expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');

  //   state.set({ bar: 'default' });
  //   await vi.advanceTimersByTimeAsync(500);
  //   expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
  // });

  // describe('url store persistence', () => {
  //   test('persists store changes', async () => {
  //     vi.useFakeTimers();
  //     const storage = new MockStorage();

  //     const state = createUrlStore<{ bar: string }>({
  //       key: 'foo',
  //       type: 'hash',
  //       defaultValue: { bar: 'default' },
  //       writeDefaultValue: true,
  //       persist: {
  //         id: 'test',
  //         storage,
  //         onlyWhenActive: true,
  //       },
  //     });

  //     using _s = state.subscribe(() => undefined);

  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map());

  //     state.set({ bar: 'baz' });
  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"baz"']]));

  //     state.set({ bar: 'default' });
  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"default"']]));
  //   });

  //   test('persists url changes while active', async () => {
  //     vi.useFakeTimers();
  //     const storage = new MockStorage();

  //     const state = createUrlStore<{ bar: string }>({
  //       key: 'foo',
  //       type: 'hash',
  //       defaultValue: { bar: 'default' },
  //       writeDefaultValue: true,
  //       persist: {
  //         id: 'test',
  //         storage,
  //         onlyWhenActive: true,
  //       },
  //     });

  //     using _s = state.subscribe(() => undefined);

  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map());

  //     window.location.hash = '#foo=%7B%22bar%22%3A%22baz%22%7D';
  //     window.dispatchEvent(new Event('popstate'));
  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"baz"']]));
  //   });

  //   test(`don't persists url changes while inactive`, async () => {
  //     vi.useFakeTimers();
  //     const storage = new MockStorage();

  //     const _state = createUrlStore<{ bar: string }>({
  //       key: 'foo',
  //       type: 'hash',
  //       defaultValue: { bar: 'default' },
  //       writeDefaultValue: true,
  //       persist: {
  //         id: 'test',
  //         storage,
  //         onlyWhenActive: true,
  //       },
  //     });

  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map());

  //     window.location.hash = '#foo=%7B%22bar%22%3A%22baz%22%7D';
  //     window.dispatchEvent(new Event('popstate'));
  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map());
  //   });

  //   test('restores persisted value', async () => {
  //     vi.useFakeTimers();
  //     const storage = new MockStorage();
  //     storage.setItem('test:["bar"]', '"baz"');

  //     const state = createUrlStore<{ bar: string }>({
  //       key: 'foo',
  //       type: 'hash',
  //       defaultValue: { bar: 'default' },
  //       writeDefaultValue: true,
  //       persist: {
  //         id: 'test',
  //         storage,
  //         onlyWhenActive: true,
  //       },
  //     });

  //     using _s = state.subscribe(() => undefined);

  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(state.get()).toEqual({ bar: 'baz' });
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"baz"']]));
  //   });

  //   test(`doesn't restore persisted value if url is set`, async () => {
  //     vi.useFakeTimers();
  //     const storage = new MockStorage();
  //     storage.setItem('test:["bar"]', '"baz"');

  //     window.location.href = 'http://localhost/#foo=%7B%22bar%22%3A%22hello%22%7D';
  //     window.dispatchEvent(new Event('popstate'));

  //     const state = createUrlStore<{ bar: string }>({
  //       key: 'foo',
  //       type: 'hash',
  //       defaultValue: { bar: 'default' },
  //       writeDefaultValue: true,
  //       persist: {
  //         id: 'test',
  //         storage,
  //         onlyWhenActive: true,
  //       },
  //     });

  //     using _s = state.subscribe(() => undefined);

  //     await vi.advanceTimersByTimeAsync(500);
  //     expect(state.get()).toEqual({ bar: 'hello' });
  //     expect(window.location.hash).toEqual('#foo=%7B%22bar%22%3A%22hello%22%7D');
  //     expect(storage.itemsWithoutVersion).toEqual(new Map([['test:["bar"]', '"hello"']]));
  //   });
  // });
});
