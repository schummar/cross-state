import { describe, expect, test } from 'vitest';
import { calcDuration } from '../../src/lib';

describe('calcDuration', () => {
  test('numeric', async () => {
    const duration = calcDuration(1000);
    expect(duration).toBe(1000);
  });

  test('milliseconds', async () => {
    const duration = calcDuration({ milliseconds: 1000 });
    expect(duration).toBe(1000);
  });

  test('seconds', async () => {
    const duration = calcDuration({ seconds: 1 });
    expect(duration).toBe(1000);
  });

  test('minutes', async () => {
    const duration = calcDuration({ minutes: 1 });
    expect(duration).toBe(60 * 1000);
  });

  test('hours', async () => {
    const duration = calcDuration({ hours: 1 });
    expect(duration).toBe(60 * 60 * 1000);
  });

  test('days', async () => {
    const duration = calcDuration({ days: 1 });
    expect(duration).toBe(24 * 60 * 60 * 1000);
  });

  test('mixed', async () => {
    const duration = calcDuration({ milliseconds: 1, seconds: 1, minutes: 1, hours: 1, days: 1 });
    expect(duration).toBe(1 + 1000 + 60 * 1000 + 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  });
});
