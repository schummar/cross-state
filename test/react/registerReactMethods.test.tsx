import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src';
import '../../src/react/register';

describe('register react methods', () => {
  test('useStore', async () => {
    const store = createStore({ x: 0 });

    const Component = vi.fn<[], any>(function Component() {
      const value = store.map('x').useStore();

      return <div data-testid="div">{value}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('0');
  });

  test('useProp', async () => {
    const store = createStore({ x: 0 });

    const Component = vi.fn<[], any>(function Component() {
      const [v, setV] = store.map('x').useProp();

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
