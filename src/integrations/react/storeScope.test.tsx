import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { atomicStore } from '../../core/atomicStore';
import { StoreScope, useStoreScope } from './storeScope';
import { useStore } from './useStore';

describe('storeContext', () => {
  test('scope context', async () => {
    const store = atomicStore(1);

    const Component = vi.fn<[], any>(function Component() {
      const scopedStore = useStoreScope(store);
      const implicit = useStore(store);
      const explicit = useStore(scopedStore);

      return (
        <div data-testid="div" onClick={() => scopedStore.set((v) => v + 1)}>
          {implicit}-{explicit}
        </div>
      );
    });

    render(
      <>
        <Component />
        <StoreScope store={store}>
          <Component />
        </StoreScope>
      </>
    );
    const [div1, div2] = screen.getAllByTestId('div') as [HTMLElement, HTMLElement];
    expect(div1.textContent).toBe('1-1');
    expect(div2.textContent).toBe('1-1');

    act(() => {
      div1.click();
      div2.click();
      div2.click();
    });

    expect(div1.textContent).toBe('2-2');
    expect(div2.textContent).toBe('3-3');
  });
});
