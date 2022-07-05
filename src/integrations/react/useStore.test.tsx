import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { asyncStore } from '../../core/asyncStore';
import { store } from '../../core/store';
import { flushPromises } from '../../lib/testHelpers';
import { StoreContextProvider, useStoreContext } from './storeContext';
import { useStore } from './useStore';

function c<T>(name: string, before: T, after1: T, after2: T, select: (t: T) => ReactNode) {
  return [name, before, after1, after2, select] as const;
}

describe('useStore', () => {
  describe.each<readonly [string, any, any, any, (t: any) => ReactNode]>([
    //
    c('object', { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, (s) => s.x),
    c('object with optionals', { a: { b: { c: 1 } } }, { a: undefined }, { a: { b: { c: 1 } } }, (s) => s.a?.b.c),
    c('array', [1, 2, 3], [1, 2, 4], [1, 2, 3, 4], (s) => s[2]),
    c('array.length', [1, 2, 3], [1, 2, 3, 4], [1, 2, 4], (s) => s.length),
  ])('%s', (_name, before, after1, after2, select) => {
    test('changed', async () => {
      const s = store(before);

      const Component = vi.fn<[], any>(function Component() {
        const v = useStore(s, select);

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
      const s = store(before);

      const Component = vi.fn<[], any>(function Component() {
        const v = useStore(s, select);

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
      const s = store(before);

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
    const s = asyncStore(async () => 1)();

    const Component = vi.fn<[], any>(function Component() {
      const [value] = useStore(s);

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

  test('scope context', async () => {
    const s = store(1);

    const Component = vi.fn<[], any>(function Component() {
      const _s = useStoreContext(s);
      const v = useStore(s);

      return (
        <div data-testid="div" onClick={() => _s.set((v) => v + 1)}>
          {v}
        </div>
      );
    });

    render(
      <>
        <Component />
        <StoreContextProvider store={s}>
          <Component />
        </StoreContextProvider>
      </>
    );
    const [div1, div2] = screen.getAllByTestId('div') as [HTMLElement, HTMLElement];
    expect(div1.textContent).toBe('1');
    expect(div2.textContent).toBe('1');

    act(() => {
      div1.click();
      div2.click();
      div2.click();
    });

    expect(div1.textContent).toBe('2');
    expect(div2.textContent).toBe('3');
  });
});
