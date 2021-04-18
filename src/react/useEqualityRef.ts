import eq from 'fast-deep-equal/es6/react';
import { useRef } from 'react';

export default function useEqualityRef<T>(x: T): T {
  const ref = useRef(x);
  if (!eq(x, ref.current)) {
    ref.current = x;
  }

  return ref.current;
}
