import type { Duration, DurationObject } from '../core/commonTypes';

const unitToMilliseconds = {
  ns: 1e-6,
  us: 1e-3,
  µs: 1e-3,
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  D: 86_400_000, // approximation - not accounting for DST changes
  M: 2_592_000_000, // approximation - 30 days
  Y: 31_536_000_000, // approximation - 365 days
} satisfies Record<string, number>;

export function calcDuration(t: Duration): number {
  switch (typeof t) {
    case 'number':
      return t;
    case 'string':
      return calcDurationString(t);
    default:
      return calcDurationObject(t);
  }
}

const plainNumberStyle = /^-?\d+(\.\d+)?$/;
const golangStyle = /^-?(\d+(\.\d+)?(h|m|s|ms|us|µs|ns))+$/;
const dotnetStyle =
  /^(?<sign>-)?((?<D>\d+)\.)?(?<h>\d{1,2}):(?<m>\d{1,2})(:(?<s>\d{1,2}))?(\.(?<ms>\d{1,3}))?$/;
const iso8601Style =
  /^(?<sign>-)?P((?<Y>\d+)Y)?((?<M>\d+)M)?((?<D>\d+)D)?T?((?<h>\d+)H)?((?<m>\d+)M)?((?<s>\d+(\.\d+)?)S)?$/;

export function calcDurationString(t: string): number {
  let match;

  if (plainNumberStyle.test(t)) {
    return parseFloat(t);
  }

  if (golangStyle.test(t)) {
    let ms = 0;
    let sign = 1;

    if (t.startsWith('-')) {
      sign = -1;
      t = t.slice(1);
    }

    const parts = t.split(/(\d+(?:\.\d+))|([a-zµ]+)/).filter(Boolean);
    for (let i = 0; i < parts.length; i += 2) {
      const value = parseFloat(parts[i]!);
      const unit = parts[i + 1] as keyof typeof unitToMilliseconds;
      ms += value * unitToMilliseconds[unit];
    }

    return ms * sign;
  }

  if ((match = t.match(dotnetStyle) ?? t.match(iso8601Style))) {
    let ms = 0;
    let sign = 1;

    for (const [unit, factor] of Object.entries(match.groups ?? {})) {
      if (!factor) {
        continue;
      }
      if (unit === 'sign') {
        sign = -1;
        continue;
      }

      ms += parseFloat(factor) * unitToMilliseconds[unit as keyof typeof unitToMilliseconds];
    }

    return ms * sign;
  }

  throw new Error(`Invalid duration string: "${t}"`);
}

export function calcDurationObject(t: DurationObject): number {
  return (
    (t.milliseconds ?? 0) +
    (t.seconds ?? 0) * unitToMilliseconds.s +
    (t.minutes ?? 0) * unitToMilliseconds.m +
    (t.hours ?? 0) * unitToMilliseconds.h +
    (t.days ?? 0) * unitToMilliseconds.D +
    (t.months ?? 0) * unitToMilliseconds.M +
    (t.years ?? 0) * unitToMilliseconds.Y
  );
}
