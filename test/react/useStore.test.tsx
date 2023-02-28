import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { createCache, createStore } from '../../src';
import { useStore } from '../../src/react';
import { flushPromises } from '../testHelpers';

function c<T>(name: string, before: T, after1: T, after2: T, select: (t: T) => ReactNode) {
  return [name, before, after1, after2, select] as const;
}

describe('useStore', () => {
  describe.each<readonly [string, any, any, any, (t: any) => ReactNode]>([
    //
    c('primitive', 0, 1, 0, (s) => s),
    c('object', { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, (s) => s.x),
    c(
      'object with optionals',
      { a: { b: { c: 1 } } },
      { a: undefined },
      { a: { b: { c: 1 } } },
      (s) => s.a?.b.c,
    ),
    c('array', [1, 2, 3], [1, 2, 4], [1, 2, 3, 4], (s) => s[2]),
    c('array.length', [1, 2, 3], [1, 2, 3, 4], [1, 2, 4], (s) => s.length),
  ])('%s', (_name, before, after1, after2, select) => {
    test('changed', async () => {
      const s = createStore(before);

      const Component = vi.fn<[], any>(function Component() {
        const v = useStore(s.map(select));

        return <div data-testid="div">{v}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      act(() => {
        s.set(after1);
      });

      expect(div.textContent).toBe(String(select(after1) ?? ''));
      expect(Component.mock.calls.length).toBe(2);
    });

    test('same', async () => {
      const s = createStore(before);

      const Component = vi.fn<[], any>(function Component() {
        const v = useStore(s.map(select));

        return <div data-testid="div">{v}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      act(() => {
        s.set(after2);
      });

      expect(div.textContent).toBe(String(select(after2)));
      expect(Component.mock.calls.length).toBe(1);
    });

    test('same without selector', async () => {
      const s = createStore(before);

      const Component = vi.fn<[], any>(function Component() {
        const v = useStore(s);

        return <div data-testid="div">{select(v)}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      act(() => {
        s.set(after2);
      });

      expect(div.textContent).toBe(String(select(after2)));
      expect(Component.mock.calls.length).toBe(1);
    });
  });

  test('only watch value', async () => {
    const s = createCache(async () => 1);

    const Component = vi.fn<[], any>(function Component() {
      const { value } = useStore(s);

      return <div data-testid="div">{value}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    await act(() => flushPromises());
    act(() => s.clear());
    await act(() => flushPromises());

    expect(div.textContent).toBe('1');

    expect(Component.mock.calls.length).toBe(4);
  });

  test('primitive/object union', async () => {
    const s = createStore<{ a: string } | string>({ a: 'a' });

    const Component = vi.fn<[], any>(function Component() {
      const value = useStore(s);

      return <div data-testid="div">{JSON.stringify(value)}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      s.set('a');
    });

    expect(div.textContent).toBe('"a"');
    expect(Component.mock.calls.length).toBe(2);
  });
});
