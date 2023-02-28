import { calcDuration } from './calcDuration';
import type { Duration } from '@core';

export type DebounceOptions =
  | Duration
  | {
      wait: Duration;
      maxWait?: Duration;
    };

export function debounce<Args extends any[]>(
  action: (...args: Args) => void,
  options: Duration | DebounceOptions,
): (...args: Args) => void {
  const wait =
    typeof options === 'object' && 'wait' in options
      ? calcDuration(options.wait)
      : calcDuration(options);

  const maxWait =
    typeof options === 'object' && 'maxWait' in options && options.maxWait !== undefined
      ? calcDuration(options.maxWait)
      : undefined;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timeoutStarted: number | undefined;

  return (...args: Args) => {
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

    timeout = setTimeout(() => {
      timeout = undefined;
      timeoutStarted = undefined;
      action(...args);
    }, deadline - now);
  };
}
