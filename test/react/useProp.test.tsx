import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src';
import { useProp } from '../../src/react';

describe('useProp', () => {
  test('get and set value', async () => {
    const s = createStore({ x: 0 });

    const Component = vi.fn<[], any>(function Component() {
      const [v, setV] = useProp(s.map('x'));

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
    expect(s.get()).toStrictEqual({ x: 1 });
  });

  test('throws when not using a string selector', async () => {
    const s = createStore({ x: 0 });

    const Component = vi.fn<[], any>(function Component() {
      const [v, setV] = useProp(s.map((state) => state.x));

      return (
        <div data-testid="div" onClick={() => setV(1)}>
          {v}
        </div>
      );
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(() => {
      act(() => {
        div.click();
      });
    }).toThrowError(
      'Can only updated computed stores that are derived from other stores using string selectors',
    );
  });
});
