import { calcDuration } from './duration';
import type { Duration } from '@core';

export type DebounceOptions =
  | Duration
  | {
      wait: Duration;
      maxWait?: Duration;
      waitOnRunNow?: boolean;
    };

export function debounce<Args extends any[]>(
  action: (...args: Args) => void,
  options: Duration | DebounceOptions,
): {
  (...args: Args): void;
  flush(): void;
  cancel(): void;
  isScheduled(): boolean;
} {
  const wait =
    typeof options === 'object' && 'wait' in options
      ? calcDuration(options.wait)
      : calcDuration(options);

  const maxWait =
    typeof options === 'object' && 'maxWait' in options && options.maxWait !== undefined
      ? calcDuration(options.maxWait)
      : undefined;

  let run: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timeoutStarted: number | undefined;

  function flush() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    run?.();
  }

  function cancel() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    run = undefined;
    timeout = undefined;
    timeoutStarted = undefined;
  }

  function isScheduled() {
    return timeout !== undefined;
  }

  function debounce(...args: Args) {
    const now = Date.now();
    timeoutStarted ??= now;

    const deadline = Math.min(
      //
      now + wait,
      timeoutStarted + (maxWait ?? Number.POSITIVE_INFINITY),
    );

    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    run = () => {
      run = undefined;
      timeout = undefined;
      timeoutStarted = undefined;

      action(...args);
    };

    timeout = setTimeout(run, deadline - now);
  }

  return Object.assign(debounce, { flush, cancel, isScheduled });
}
