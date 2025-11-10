import useLatestFunction from '@react/lib/useLatestFunction';
import { renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { expect, test } from 'vitest';

test('useLatestFunction', () => {
  let getter: (() => number) | undefined;

  const { result, rerender } = renderHook(
    (value: number) => {
      const ref = useLatestFunction(() => value);
      useEffect(() => {
        getter = () => ref();
        // oxlint-disable-next-line exhaustive-deps
      }, []);

      return ref();
    },
    { initialProps: 1 },
  );

  expect(result.current).toBe(1);
  expect(getter?.()).toBe(1);
  rerender(2);
  expect(result.current).toBe(2);
  expect(getter?.()).toBe(2);
});
