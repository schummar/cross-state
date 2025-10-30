import { useEffect, useRef } from 'react';

export default function useLatestRef<T>(value: T): { current: T } {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
