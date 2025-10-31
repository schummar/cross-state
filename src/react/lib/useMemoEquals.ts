import { deepEqual } from '@lib/equals';
import { useEffect, useRef } from 'react';

export default function useMemoEquals<T>(value: T, equals: (a: T, b: T) => boolean = deepEqual): T {
  const ref = useRef<{ value: T }>(undefined);
  const hasChanged = !ref.current || !equals(ref.current.value, value);

  useEffect(() => {
    if (hasChanged) {
      ref.current = { value };
    }
  });

  return hasChanged ? value : ref.current!.value;
}
