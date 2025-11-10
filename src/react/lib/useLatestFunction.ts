import useLatestRef from '@react/lib/useLatestRef';
import { useCallback } from 'react';

export default function useLatestFunction<Args extends any[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const ref = useLatestRef(fn);

  return useCallback(
    (...args: Args) => {
      return ref.current(...args);
    },
    [ref],
  );
}
