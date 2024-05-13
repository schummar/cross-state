import { describe, expect, test } from 'vitest';
import type { Path, Value } from '../../src/lib/path';
import { get, set } from '../../src/lib/propAccess';

function g<T extends Record<string | number, unknown> | readonly unknown[], P extends Path<T>>(
  name: string,
  object: T,
  path: P,
  checkValue: Value<T, P>,
  newValue: Value<T, P>,
  newObject: T | Error,
) {
  return [name, object, path, checkValue, newValue, newObject] as const;
}

describe('propAccess', () => {
  describe.each([
    //
    g('object', { x: 0 }, 'x', 0, 1, { x: 1 }),
    g('array', [1, 2, 3], [1], 2, 4, [1, 4, 3]),
    g('nested', { x: [{ y: 1 }] } as { x: [{ y: number }] }, ['x', 0, 'y'], 1, 2, {
      x: [{ y: 2 }],
    }),
    g('nested undefined', { x: {} } as { x: { y?: { z: 1 } } }, 'x.y.z', undefined, 1, {
      x: { y: { z: 1 } },
    }),
  ])('prop access %s', (_name, object: any, path, checkValue, newValue, newObject) => {
    test('get', async () => {
      const calculatedValue = get(object, path as any);

      expect(calculatedValue).toBe(checkValue);
    });

    test('set', async () => {
      const backup = JSON.parse(JSON.stringify(object));

      const updated = set(object, path as any, newValue);
      expect(updated).toEqual(newObject);
      expect(object).toEqual(backup);
    });
  });
});
