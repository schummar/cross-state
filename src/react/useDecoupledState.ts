import { type Duration } from '@core';
import { debounce } from '@lib/debounce';
import isPromise from '@lib/isPromise';
import type { MaybePromise } from '@lib/maybePromise';
import { throttle } from '@lib/throttle';
import useLatestFunction from '@react/lib/useLatestFunction';
import useMemoEquals from '@react/lib/useMemoEquals';
import { startTransition, useMemo, useRef, useState } from 'react';

export interface UseDecoupledStateOptions<T> {
  debounce?: Duration;
  throttle?: Duration;
  onCommit?: (value: T) => void;
}

export function useDecoupledState<T>(
  value: T,
  onChange: (value: T) => MaybePromise<void>,
  options: UseDecoupledStateOptions<T> = {},
): [state: T, setState: (value: T) => void] {
  const [dirty, setDirty] = useState<{ v: T }>();
  const onChangeAC = useRef<AbortController>(undefined);

  const latestOnChange = useLatestFunction(onChange);
  const latestOnCommit = useLatestFunction(options.onCommit ?? (() => {}));
  const debounceOptions = useMemoEquals(options.debounce);
  const throttleOptions = useMemoEquals(options.throttle);

  const update = useMemo(() => {
    const update = async (value: T) => {
      const result = latestOnChange(value);

      if (isPromise(result)) {
        const ac = (onChangeAC.current = new AbortController());

        await result;

        if (ac.signal.aborted) {
          return;
        }
      }

      latestOnCommit(value);
      setDirty(undefined);
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
      onChangeAC.current?.abort();
      setDirty({ v: value });
      delayedUpdate(value);
    };
  }, [latestOnChange, latestOnCommit, debounceOptions, throttleOptions]);

  return [dirty ? dirty.v : value, update];
}
