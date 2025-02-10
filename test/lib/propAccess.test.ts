import { describe, expect, expectTypeOf, test } from 'vitest';
import type { Path, Value } from '../../src/lib/path';
import { get, remove, set } from '../../src/lib/propAccess';

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

  describe('get types', () => {
    test('with string path', () => {
      const x = { a: [{ b: '' }] };
      const y = get(x, 'a.0.b');

      expectTypeOf(y).toEqualTypeOf<string | undefined>();
    });

    test('with array path', () => {
      const x = { a: [{ b: '' }] };
      const y = get(x, ['a', 0, 'b']);

      expectTypeOf(y).toEqualTypeOf<string | undefined>();
    });

    test('with wrong path', async () => {
      const x = { a: [{ b: '' }] };
      // @ts-expect-error - invalid path
      const y = get(x, 'a.0.c');

      expect(y).toBe(undefined);
    });
  });

  describe('set types', () => {
    test('with string path', () => {
      const x = { a: [{ b: '' }] };
      const _y = set(x, 'a.0.b', 'c');
      // @ts-expect-error - should only accept string
      set(x, 'a.0.b', undefined);
    });

    test('with array path', () => {
      const x = { a: [{ b: '' }] };
      set(x, ['a', 0, 'b'], 'c');
      // @ts-expect-error - should only accept string
      set(x, ['a', 0, 'b'], { b: '' });
    });

    test('with wrong path', async () => {
      const x = { a: [{ b: '' }] };
      // @ts-expect-error - invalid path
      set(x, 'a.0.c', 'c');
    });
  });

  describe('remove', () => {
    test('remove', () => {
      const x: { a: string; b?: string } = { a: '', b: '' };
      const y = remove(x, 'b');

      expect(y).toEqual({ a: '' });

      // @ts-expect-error - should not accept non-optional property
      remove(x, 'a');
      // @ts-expect-error - should not accept non-optional property
      remove(x, ['a']);
    });
  });
});
