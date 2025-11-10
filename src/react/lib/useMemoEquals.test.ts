import useMemoEquals from '@react/lib/useMemoEquals';
import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';

test('useMemoEquals', () => {
  const firstValue = { a: 1 };
  const { result, rerender } = renderHook((value) => useMemoEquals(value), {
    initialProps: firstValue,
  });

  expect(result.current).toBe(firstValue);

  rerender({ a: 1 });
  expect(result.current).toBe(firstValue);

  rerender({ a: 2 });
  expect(result.current).not.toBe(firstValue);
});
