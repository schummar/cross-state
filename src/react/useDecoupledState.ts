import { type Duration } from '@core';
import { debounce } from '@lib/debounce';
import { throttle } from '@lib/throttle';
import useLatestFunction from '@react/lib/useLatestFunction';
import useMemoEquals from '@react/lib/useMemoEquals';
import { startTransition, useMemo, useState } from 'react';

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
  const latestOnChange = useLatestFunction(onChange);
  const latestOnCommit = useLatestFunction(options.onCommit ?? (() => {}));

  const debounceOptions = useMemoEquals(options.debounce);
  const throttleOptions = useMemoEquals(options.throttle);

  const update = useMemo(() => {
    const update = (value: T) => {
      latestOnChange(value);
      setDirty(undefined);
      latestOnCommit(value);
    };

    let delayedUpdate: (value: T) => void;

    if (debounceOptions) {
      delayedUpdate = debounce(update, debounceOptions);
    } else if (throttleOptions) {
      delayedUpdate = throttle(update, throttleOptions);
    } else {
      delayedUpdate = (value) => startTransition(() => update(value));
    }

    return (value: T) => {
      setDirty({ v: value });
      delayedUpdate(value);
    };
  }, [latestOnChange, latestOnCommit, debounceOptions, throttleOptions]);

  return [dirty ? dirty.v : value, update];
}
