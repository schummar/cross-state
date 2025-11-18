import { calcDuration } from './duration';
import type { Duration } from '@core';

export function throttle<Args extends any[]>(
  action: (...args: Args) => void,
  duration: Duration,
): (...args: Args) => void {
  const ms = calcDuration(duration);

  let t = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return (...args: Args) => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    const dt = t + ms - Date.now();
    if (dt <= 0) {
      action(...args);
      t = Date.now();
      return;
    }

    timeout = setTimeout(() => {
      action(...args);
      t = Date.now();
    }, dt);
  };
}
