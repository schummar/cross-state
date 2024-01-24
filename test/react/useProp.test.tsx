import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src';
import { useProp } from '../../src/react';

describe('useProp', () => {
  test('get and set value', async () => {
    const store = createStore({ x: 0 });

    const Component = vi.fn<[], any>(function Component() {
      const [v, setV] = useProp(store.map('x'));

      return (
        <div data-testid="div" onClick={() => setV(1)}>
          {v}
        </div>
      );
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      div.click();
    });

    expect(div.textContent).toBe('1');
    expect(store.get()).toStrictEqual({ x: 1 });
  });

  test('throws when not using a string selector', async () => {
    const store = createStore({ x: 0 });

    const Component = vi.fn<[], any>(function Component() {
      const [v, setV] = useProp(store.map((state) => state.x));

      return (
        <div
          data-testid="div"
          onClick={() => {
            expect(() => {
              setV(1);
            }).toThrowErrorMatchingInlineSnapshot(
              `[TypeError: Can only update computed stores that either are derived from other stores using string selectors or have an updater function.]`,
            );
          }}
        >
          {v}
        </div>
      );
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      div.click();
    });
  });

  test('inline function selector', async () => {
    const store = createStore({ x: 0 });

    const Component = vi.fn<[], any>(function Component() {
      const [v, setV] = useProp(
        store,
        (state) => state.x,
        (x) => ({ x }),
      );

      return (
        <div data-testid="div" onClick={() => setV(1)}>
          {v}
        </div>
      );
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      div.click();
    });

    expect(div.textContent).toBe('1');
    expect(store.get()).toStrictEqual({ x: 1 });
  });

  test('inline string selector', async () => {
    const store = createStore({ x: 0 });

    const Component = vi.fn<[], any>(function Component() {
      const [v, setV] = useProp(store, 'x');

      return (
        <div data-testid="div" onClick={() => setV(1)}>
          {v}
        </div>
      );
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      div.click();
    });

    expect(div.textContent).toBe('1');
    expect(store.get()).toStrictEqual({ x: 1 });
  });
});
