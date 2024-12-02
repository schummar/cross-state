import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { type Duration } from '@core';
import { debounce } from '@lib/debounce';
import { simpleHash } from '@lib/hash';
import { throttle } from '@lib/throttle';

export interface UseDecoupledStateOptions<T> {
  debounce?: Duration;
  throttle?: Duration;
  onCommit?: (value: T) => void;
}

export function useDecoupledState<T>(
  value: T,
  onChange: (value: T) => void,
  options: UseDecoupledStateOptions<T> = {},
): [state: T, setState: (value: T) => void] {
  const [dirty, setDirty] = useState<{ v: T }>();
  const ref = useRef({ onChange, onCommit: options.onCommit });

  useEffect(() => {
    ref.current = { onChange, onCommit: options.onCommit };
  }, [onChange]);

  const update = useMemo(() => {
    const { onChange, onCommit } = ref.current;

    const update = (value: T) => {
      onChange(value);
      setDirty(undefined);
      onCommit?.(value);
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
  }, [simpleHash([options.debounce, options.throttle])]);

  return [dirty ? dirty.v : value, update];
}
