import useLatestRef from '@react/lib/useLatestRef';
import { renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { expect, test } from 'vitest';

test('useLatestRef', () => {
  let getter: (() => number) | undefined;

  const { result, rerender } = renderHook(
    (value: number) => {
      const ref = useLatestRef(value);
      useEffect(() => {
        getter = () => ref.current;
        // oxlint-disable-next-line exhaustive-deps
      }, []);

      return ref.current;
    },
    { initialProps: 1 },
  );

  expect(result.current).toBe(1);
  expect(getter?.()).toBe(1);
  rerender(2);
  expect(result.current).toBe(2);
  expect(getter?.()).toBe(2);
});
