import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { store } from '../../core/store';
import type { Path, Value } from '../../lib/propAccess';
import { get } from '../../lib/propAccess';
import { useProp } from './useProp';

function c<T extends Record<string, unknown> | unknown[], P extends Path<T>>(name: string, obj: T, path: P, newValue: Value<T, P>) {
  return [name, obj, path, newValue] as const;
}

describe('useProp', () => {
  describe.each<readonly [string, any, string, any]>([
    //
    c('object', { x: 0, y: 0 }, 'x', 1),
    c('object with optionals', { a: { b: { c: 1 } } }, 'a.b.c', 2),
    c('array', [1, 2, 3], '2', 4),
    c('array.length', [1, 2, 3], 'length', 0),
  ])('%s', (_name, obj, path, newValue) => {
    test('useProp', async () => {
      const s = store(obj);

      const Component = vi.fn<[], any>(function Component() {
        const [v, set] = useProp(s, path);

        console.log(v, set);

        return (
          <div data-testid="div" onClick={() => set(newValue)}>
            {v}
          </div>
        );
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      act(() => {
        div.click();
      });

      expect(div.textContent).toBe(String(get(after1, select) ?? ''));
      expect(Component.mock.calls.length).toBe(2);
    });
  });
});
