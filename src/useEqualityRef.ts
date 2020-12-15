import eq from 'fast-deep-equal';
import { useRef } from 'react';

export default function useEqualityRef<T>(x: T): T {
  const ref = useRef(x);
  if (!eq(x, ref.current)) {
    ref.current = x;
  }

  return ref.current;
}
