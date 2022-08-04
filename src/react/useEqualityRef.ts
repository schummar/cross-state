import { circularDeepEqual } from 'fast-equals';
import { useRef } from 'react';

export default function useEqualityRef<T>(x: T): T {
  const ref = useRef(x);
  if (!circularDeepEqual(x, ref.current)) {
    ref.current = x;
  }

  return ref.current;
}
