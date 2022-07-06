import { describe, expect, test } from 'vitest';
import type { Path, Value } from './propAccess';
import { get, set } from './propAccess';

function g<T extends Record<string | number, unknown> | readonly unknown[], P extends Path<T>>(
  name: string,
  obj: T,
  path: P,
  checkValue: Value<T, P>,
  newValue: Value<T, P>,
  newObj: T | Error
) {
  return [name, obj, path, checkValue, newValue, newObj] as const;
}

describe('propAccess', () => {
  describe.each([
    //
    g('object', { x: 0 }, 'x', 0, 1, { x: 1 }),
    g('array', [1, 2, 3], '1', 2, 4, [1, 4, 3]),
    g('nested', { x: [{ y: 1 }] } as { x: [{ y: number }] }, 'x.0.y', 1, 2, { x: [{ y: 2 }] }),
    g('nested undefined', { x: {} } as { x: { y?: { z: 1 } } }, 'x.y.z', undefined, 1, Error()),
  ])('%s', (_name, obj: any, path, checkValue, newValue, newObj) => {
    test('get', async () => {
      const calculatedValue = get(obj, path);

      expect(calculatedValue).toBe(checkValue);
    });

    test('set', async () => {
      const backup = structuredClone(obj);

      if (newObj instanceof Error) {
        expect(() => set(obj, path, newValue)).toThrow('Cannot set x.y.z because x.y is undefined');
      } else {
        const updated = set(obj, path, newValue);
        expect(updated).toEqual(newObj);
      }

      expect(obj).toEqual(backup);
    });
  });
});
