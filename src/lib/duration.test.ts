import { calcDuration } from '@lib/duration';
import { describe, expect, test } from 'vitest';

describe('number durations', () => {
  test('returns the same number', () => {
    expect(calcDuration(5000)).toBe(5000);
  });

  test('returns a number string as number', () => {
    expect(calcDuration('5000')).toBe(5000);
  });
});

describe('object durations', () => {
  test('simple durations', () => {
    expect(calcDuration({ hours: 1, minutes: 10 })).toBe(4200000);
  });

  test('with all units', () => {
    expect(
      calcDuration({
        days: 2,
        hours: 1,
        minutes: 2,
        seconds: 3,
        milliseconds: 4,
      }),
    ).toBe(176523004);
  });

  test('zero duration', () => {
    expect(calcDuration({})).toBe(0);
  });
});

describe('golang style durations', () => {
  test('simple durations', () => {
    expect(calcDuration('1h10m')).toBe(4200000);
  });

  test('with all units', () => {
    expect(calcDuration('1h2m3s4ms5us6µs7ns')).toBe(3723004.0110069998);
  });

  test('negative durations', () => {
    expect(calcDuration('-1h30m')).toBe(-5400000);
  });

  test('duplicate units', () => {
    expect(calcDuration('1m1m')).toBe(120000);
  });
});

describe('dotnet style durations', () => {
  test('simple durations', () => {
    expect(calcDuration('1:10:00')).toBe(4200000);
  });

  test('with days and milliseconds', () => {
    expect(calcDuration('2.01:02:03.004')).toBe(176523004);
  });

  test('negative durations', () => {
    expect(calcDuration('-1:30:00')).toBe(-5400000);
  });
});

describe('iso8601 style durations', () => {
  test('simple durations', () => {
    expect(calcDuration('PT1H10M')).toBe(4200000);
  });

  test('with all units', () => {
    expect(calcDuration('P2DT1H2M3.004S')).toBe(176523004);
  });

  test('negative durations', () => {
    expect(calcDuration('-PT1H30M')).toBe(-5400000);
  });
});

describe('invalid durations', () => {
  test('throws error for invalid strings', () => {
    expect(() => calcDuration('invalid')).toThrowError('Invalid duration string: "invalid"');
  });
});
