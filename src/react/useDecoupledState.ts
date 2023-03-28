import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from '@lib/debounce';
import { throttle } from '@lib/throttle';

export interface UseDecoupledStateOptions {
  debounce?: number;
  throttle?: number;
}

export function useDecoupledState<T>(
  value: T,
  onChange: (value: T) => void,
  options: UseDecoupledStateOptions,
): [state: T, setState: (value: T) => void] {
  const [dirty, setDirty] = useState<{ v: T }>();
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const update = useMemo(() => {
    const update = (value: T) => {
      onChangeRef.current(value);
      setDirty(undefined);
    };

    let delayedUpdate: (value: T) => void;

    if (options.debounce) {
      delayedUpdate = debounce(update, options.debounce);
    } else if (options.throttle) {
      delayedUpdate = throttle(update, options.throttle);
    } else {
      delayedUpdate = (value) => startTransition(() => update(value));
    }

    return (value: T) => {
      setDirty({ v: value });
      delayedUpdate(value);
    };
  }, [options.debounce, options.throttle]);

  return [dirty ? dirty.v : value, update];
}
