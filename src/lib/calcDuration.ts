import type { Duration } from '../core/commonTypes';

export function calcDuration(t: Duration): number {
  if (typeof t === 'number') return t;
  return (
    (t.milliseconds ?? 0) +
    (t.seconds ?? 0) * 1000 +
    (t.minutes ?? 0) * 60 * 1000 +
    (t.hours ?? 0) * 60 * 60 * 1000 +
    (t.days ?? 0) * 24 * 60 * 60 * 1000
  );
}
