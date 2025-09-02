import { createStore } from '@core';
import { UrlProvider, useStore, useUrlParam } from '@react';
import { createStorageKey } from '@react/url/useUrlParam';
import { renderHook } from '@testing-library/react';
import { act, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const _urlStore = createStore('/');

function getHash() {
  return _urlStore.get().slice(1);
}

function setUrlParams(params: Record<string, unknown>) {
  const urlParams = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, JSON.stringify(value)]),
  ).toString();

  act(() => {
    _urlStore.set(`/#${urlParams}`);
  });
}

beforeEach(() => {
  _urlStore.set('/');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <UrlProvider
    locationHook={() => useStore(_urlStore)}
    navigate={(nav) => {
      const newUrl = nav(_urlStore.get());
      _urlStore.set(newUrl);
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

    setUrlParams({ foo: 'bar' });
    expect(result.current[0]).toBe('bar');

    act(() => result.current[1]('baz'));
    expect(getHash()).toEqual('#foo=%22bar%22');

    await act(() => vi.runAllTimersAsync());
    expect(getHash()).toEqual('#foo=%22baz%22');
  });

  test('createUrlStore with defaultValue', async () => {
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

    await act(() => vi.runAllTimersAsync());
    expect(getHash()).toBe('#foo=%7B%22bar%22%3A%22baz%22%7D');

    act(() => result.current[1]({ bar: 'default' }));
    await act(() => vi.runAllTimersAsync());
    expect(getHash()).toBe('');
  });

  test('writeDefaultValue=true', async () => {
    const { result } = renderHook(
      () =>
        useUrlParam({
          key: 'foo',
          type: 'hash',
          defaultValue: { bar: 'default' },
          writeDefaultValue: true,
        }),
      { wrapper },
    );

    expect(result.current[0]).toEqual({ bar: 'default' });
    await act(() => vi.runAllTimersAsync());
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');

    act(() => result.current[1]({ bar: 'baz' }));
    await act(() => vi.runAllTimersAsync());
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');

    act(() => result.current[1]({ bar: 'default' }));
    await act(() => vi.runAllTimersAsync());
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
  });

  describe('url store persistence', () => {
    const persistKey = createStorageKey('test', 'foo');

    beforeEach(() => {
      localStorage.clear();
    });

    test('persists store changes', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(
        () =>
          useUrlParam({
            key: 'foo',
            type: 'hash',
            defaultValue: { bar: 'default' },
            writeDefaultValue: true,
            persist: { id: 'test' },
          }),
        { wrapper },
      );

      await act(() => vi.runAllTimersAsync());
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');

      act(() => result.current[1]({ bar: 'baz' }));
      await act(() => vi.runAllTimersAsync());
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"baz"}');

      act(() => result.current[1]({ bar: 'default' }));
      await act(() => vi.runAllTimersAsync());
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');
    });

    test('persists url changes while active', async () => {
      vi.useFakeTimers();
      renderHook(
        () =>
          useUrlParam({
            key: 'foo',
            type: 'hash',
            defaultValue: { bar: 'default' },
            writeDefaultValue: true,
            persist: { id: 'test' },
          }),
        { wrapper },
      );

      await act(() => vi.runAllTimersAsync());
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');

      setUrlParams({ foo: { bar: 'baz' } });
      await act(() => vi.runAllTimersAsync());
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"baz"}');
    });

    test(`don't persists url changes while inactive`, async () => {
      vi.useFakeTimers();
      const { unmount } = renderHook(
        () =>
          useUrlParam({
            key: 'foo',
            type: 'hash',
            defaultValue: { bar: 'default' },
            writeDefaultValue: true,
            persist: { id: 'test' },
          }),
        { wrapper },
      );

      await act(() => vi.runAllTimersAsync());
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');

      unmount();
      setUrlParams({ foo: { bar: 'baz' } });
      await act(() => vi.runAllTimersAsync());
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');
    });

    test('restores persisted value', async () => {
      vi.useFakeTimers();
      localStorage.setItem(persistKey, '{"bar":"baz"}');

      const { result } = renderHook(
        () =>
          useUrlParam({
            key: 'foo',
            type: 'hash',
            defaultValue: { bar: 'default' },
            writeDefaultValue: true,
            persist: { id: 'test' },
          }),
        { wrapper },
      );

      await act(() => vi.runAllTimersAsync());
      expect(result.current[0]).toEqual({ bar: 'baz' });
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"baz"}');
    });

    test(`doesn't restore persisted value if url is set`, async () => {
      vi.useFakeTimers();
      localStorage.setItem(persistKey, '{"bar":"baz"}');
      setUrlParams({ foo: { bar: 'hello' } });

      const { result } = renderHook(
        () =>
          useUrlParam({
            key: 'foo',
            type: 'hash',
            defaultValue: { bar: 'default' },
            writeDefaultValue: true,
            persist: { id: 'test' },
          }),
        { wrapper },
      );

      await act(() => vi.runAllTimersAsync());
      expect(result.current[0]).toEqual({ bar: 'hello' });
      expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22hello%22%7D');
      expect(localStorage.getItem(persistKey)).toBe('{"bar":"hello"}');
    });
  });
});
