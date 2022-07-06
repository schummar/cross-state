import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { atomicStore } from '../../core/atomicStore';
import type { Path, Value } from '../../lib/propAccess';
import { useProp } from './useProp';

function c<T extends Record<string | number, unknown> | readonly unknown[], P extends Path<T>>(
  name: string,
  obj: T,
  path: P,
  oldValue: Value<T, P>,
  newValue: Value<T, P>
) {
  return [name, obj, path, oldValue, newValue] as const;
}

describe('useProp', () => {
  describe.each<readonly [string, any, string, any, any]>([
    //
    c('object', { x: 0, y: 0 }, 'x', 0, 1),
    c('nested object', { a: { b: { c: 1 } } }, 'a.b.c', 1, 2),
    c('array', [1, 2, 3] as [number, number, number], '2', 3, 4),
  ])('%s', (_name, obj, path, oldValue, newValue) => {
    test('useProp', async () => {
      const store = atomicStore(obj);

      const Component = vi.fn<[], any>(function Component() {
        const [v, set] = useProp(store, path);

        return (
          <div data-testid="div" onClick={() => set(newValue)}>
            {v as ReactNode}
          </div>
        );
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      expect(div.textContent).toBe(String(oldValue ?? ''));

      act(() => {
        div.click();
      });

      expect(div.textContent).toBe(String(newValue ?? ''));
      expect(Component.mock.calls.length).toBe(2);
    });
  });
});
