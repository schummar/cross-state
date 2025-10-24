import { createUrlParam } from '@react';
import '@react/register';
import { createStorageKey } from '@react/url/urlParamStore';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

function getHash() {
  const url = new URL(window.location.href);
  return url.hash;
}

function setUrlParams(params: Record<string, unknown>) {
  const urlParams = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, JSON.stringify(value)]),
  ).toString();

  act(() => {
    const url = new URL(window.location.href);
    url.hash = urlParams ? `#${urlParams}` : '';
    window.history.replaceState(window.history.state, '', url.toString());
    window.location.href = url.toString();
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

beforeEach(() => {
  window.location.href = '/';
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('createUrlParam', async () => {
  const urlParam = createUrlParam<string>({ type: 'hash', key: 'foo' });
  const { result } = renderHook(() => urlParam.useProp());

  setUrlParams({ foo: 'bar' });
  expect(result.current[0]).toBe('bar');

  act(() => result.current[1]('baz'));
  expect(getHash()).toEqual('#foo=%22baz%22');
});

test('createUrlParam with defaultValue', async () => {
  const urlParam = createUrlParam({ key: 'foo', type: 'hash', defaultValue: { bar: 'default' } });
  const { result } = renderHook(() => urlParam.useProp());

  expect(result.current[0]).toEqual({ bar: 'default' });

  act(() => result.current[1]({ bar: 'baz' }));
  expect(result.current[0]).toEqual({ bar: 'baz' });

  expect(getHash()).toBe('#foo=%7B%22bar%22%3A%22baz%22%7D');

  act(() => result.current[1]({ bar: 'default' }));
  expect(getHash()).toBe('');
});

test('writeDefaultValue=true', async () => {
  const urlParam = createUrlParam({
    key: 'foo',
    type: 'hash',
    defaultValue: { bar: 'default' },
    writeDefaultValue: true,
  });
  const { result } = renderHook(() => urlParam.useProp());

  expect(result.current[0]).toEqual({ bar: 'default' });
  expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');

  act(() => result.current[1]({ bar: 'baz' }));
  expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');

  act(() => result.current[1]({ bar: 'default' }));
  expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
});

test(`urlStore doesn't read url when outside of its path`, () => {
  window.location.href = '/a';
  window.dispatchEvent(new PopStateEvent('popstate'));

  const urlParam = createUrlParam({
    key: 'foo',
    type: 'hash',
    defaultValue: 'foo',
    writeDefaultValue: true,
    path: '/a',
  });

  const { result } = renderHook(() => urlParam.useProp());
  act(() => {
    result.current[1]('bar');
  });
  expect(result.current[0]).toEqual('bar');

  act(() => {
    window.location.href = '/b';
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(result.current[0]).toEqual('bar');
});

test(`urlStore will save value in storage even when outside of its path`, () => {
  window.location.href = '/a';
  window.dispatchEvent(new PopStateEvent('popstate'));

  const urlParam = createUrlParam({
    key: 'foo',
    type: 'hash',
    defaultValue: 'foo',
    writeDefaultValue: true,
    path: '/a',
    persist: { id: 'test' },
  });

  const { result } = renderHook(() => urlParam.useProp());

  act(() => {
    window.location.href = '/b';
    window.dispatchEvent(new PopStateEvent('popstate'));
    result.current[1]('bar');
  });

  expect(result.current[0]).toEqual('foo');
  expect(localStorage.getItem(createStorageKey('test', 'foo'))).toEqual('"bar"');
  expect(getHash()).toEqual('');

  act(() => {
    window.location.href = '/a';
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  expect(result.current[0]).toEqual('bar');
  expect(getHash()).toEqual('#foo=%22bar%22');
});

test(`urlStore doesn't write url when outside of its path`, () => {
  window.location.href = '/a';
  window.dispatchEvent(new PopStateEvent('popstate'));

  const urlParam1 = createUrlParam({
    key: 'foo',
    type: 'hash',
    defaultValue: 'foo',
    writeDefaultValue: true,
    path: '/a',
  });

  const urlParam2 = createUrlParam({
    key: 'bar',
    type: 'hash',
    defaultValue: 'bar',
    writeDefaultValue: true,
    path: [/b/],
  });

  const { unmount } = renderHook(() => urlParam1.useProp());
  expect(getHash()).toEqual('#foo=%22foo%22');

  // Url often changes before the old component is unmounted
  // A new component might even mount before the old one is unmounted
  act(() => {
    window.location.href = '/b';
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  renderHook(() => urlParam2.useProp());
  unmount();

  expect(getHash()).toEqual('#bar=%22bar%22');
});

describe('url store persistence', () => {
  const persistKey = createStorageKey('test', 'foo');

  test('persists store changes', async () => {
    const urlParam = createUrlParam({
      key: 'foo',
      type: 'hash',
      defaultValue: { bar: 'default' },
      writeDefaultValue: true,
      persist: { id: 'test' },
    });
    const { result } = renderHook(() => urlParam.useProp());

    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');

    act(() => result.current[1]({ bar: 'baz' }));
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"baz"}');

    act(() => result.current[1]({ bar: 'default' }));
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');
  });

  test('persists url changes while active', async () => {
    const urlParam = createUrlParam({
      key: 'foo',
      type: 'hash',
      defaultValue: { bar: 'default' },
      writeDefaultValue: true,
      persist: { id: 'test' },
    });
    renderHook(() => urlParam.useProp());

    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');

    setUrlParams({ foo: { bar: 'baz' } });
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"baz"}');
  });

  test(`don't persists url changes while inactive`, async () => {
    const urlParam = createUrlParam({
      key: 'foo',
      type: 'hash',
      defaultValue: { bar: 'default' },
      writeDefaultValue: true,
      persist: { id: 'test' },
    });
    const { unmount } = renderHook(() => urlParam.useProp());

    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22default%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');

    unmount();
    setUrlParams({ foo: { bar: 'baz' } });
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"default"}');
  });

  test('restores persisted value', async () => {
    localStorage.setItem(persistKey, '{"bar":"baz"}');

    const urlParam = createUrlParam({
      key: 'foo',
      type: 'hash',
      defaultValue: { bar: 'default' },
      writeDefaultValue: true,
      persist: { id: 'test' },
    });
    const { result } = renderHook(() => urlParam.useProp());

    expect(result.current[0]).toEqual({ bar: 'baz' });
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22baz%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"baz"}');
  });

  test(`doesn't restore persisted value if url is set`, async () => {
    localStorage.setItem(persistKey, '{"bar":"baz"}');
    setUrlParams({ foo: { bar: 'hello' } });

    const urlParam = createUrlParam({
      key: 'foo',
      type: 'hash',
      defaultValue: { bar: 'default' },
      writeDefaultValue: true,
      persist: { id: 'test' },
    });
    const { result } = renderHook(() => urlParam.useProp());

    expect(result.current[0]).toEqual({ bar: 'hello' });
    expect(getHash()).toEqual('#foo=%7B%22bar%22%3A%22hello%22%7D');
    expect(localStorage.getItem(persistKey)).toBe('{"bar":"hello"}');
  });
});

describe('bugs', () => {
  test('url change to defaultValue was ignored when writeDefaultValue is false and storage has value', () => {
    localStorage.setItem('cross-state:url:test:foo', 'false');

    const urlParam = createUrlParam({
      key: 'foo',
      type: 'hash',
      defaultValue: true,
      persist: { id: 'test' },
    });

    const { result } = renderHook(() => urlParam.useProp());
    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));
    expect(getHash()).toBe('');
    expect(localStorage.getItem('cross-state:url:test:foo')).toBe('true');
    expect(result.current[0]).toBe(true);
  });
});
