import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { store } from '../../core/store';
import { StoreContextProvider, useStoreContext } from './storeContext';
import { useStore } from './useStore';

describe('storeContext', () => {
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
