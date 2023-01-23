import { describe, expectTypeOf, test } from 'vitest';
import type { GetKeys, Path, PathAsArray, Value } from '../../src/lib/path';

describe('path', () => {
  describe('GetKeys', () => {
    test('object', () => {
      expectTypeOf({} as GetKeys<{ x: number; y: number }>).toEqualTypeOf<'x' | 'y'>();
    });

    test('array', () => {
      expectTypeOf({} as GetKeys<number[]>).toEqualTypeOf<number>();
    });

    test('tuple', () => {
      expectTypeOf({} as GetKeys<[number, string]>).toEqualTypeOf<0 | 1>();
    });
  });

  describe('Path', () => {
    test('object', () => {
      expectTypeOf({} as Path<{ x: number; y: number }>).toEqualTypeOf<['x'] | ['y'] | 'x' | 'y'>();
    });

    test('record', () => {
      expectTypeOf({} as Path<Record<string, number>>).toEqualTypeOf<[string] | string>();
    });

    test('array', () => {
      expectTypeOf({} as Path<number[]>).toEqualTypeOf<[number]>();
    });

    test('tuple', () => {
      expectTypeOf({} as Path<[number, string]>).toEqualTypeOf<[0] | [1]>();
    });

    test('map', () => {
      expectTypeOf({} as Path<Map<string, number>>).toEqualTypeOf<[string] | string>();
    });

    test('set', () => {
      expectTypeOf({} as Path<Set<number>>).toEqualTypeOf<[number]>();
    });

    test('no simplified path for non strings', () => {
      expectTypeOf({} as Path<{ 1: 2 }>).toEqualTypeOf<[1]>();
    });

    test('no simplified path for string containing dots', () => {
      expectTypeOf({} as Path<{ 'a.b': { c: number }; d: number }>).toEqualTypeOf<['a.b'] | ['a.b', 'c'] | ['d'] | 'd'>();
    });

    test('nested', () => {
      expectTypeOf(
        {} as PathAsArray<{
          a: number;
          b: {
            c: [Map<number, { x: number }>, Set<{ x: number }>][];
          };
        }>
      ).toEqualTypeOf<
        | ['a']
        | ['b']
        | ['b', 'c']
        | ['b', 'c', number]
        | ['b', 'c', number, 0]
        | ['b', 'c', number, 0, number]
        | ['b', 'c', number, 0, number, 'x']
        | ['b', 'c', number, 1]
        | ['b', 'c', number, 1, number]
      >();
    });
  });

  describe('Value', () => {
    test('object', () => {
      expectTypeOf({} as Value<{ x: 'value'; y: 'value' }, 'x'>).toEqualTypeOf<'value'>();
    });

    test('record', () => {
      expectTypeOf({} as Value<Record<string, 'value'>, ['x']>).toEqualTypeOf<'value' | undefined>();
    });

    test('array', () => {
      expectTypeOf({} as Value<'value'[], [0]>).toEqualTypeOf<'value' | undefined>();
    });

    test('tuple', () => {
      expectTypeOf({} as Value<['other', 'value'], [1]>).toEqualTypeOf<'value'>();
    });

    test('map', () => {
      expectTypeOf({} as Value<Map<string, 'value'>, ['x']>).toEqualTypeOf<'value' | undefined>();
    });

    test('set', () => {
      expectTypeOf({} as Value<Set<'value'>, [0]>).toEqualTypeOf<'value' | undefined>();
    });

    test('nested', () => {
      expectTypeOf(
        {} as Value<
          {
            a: number;
            b: {
              c: [Map<number, { x: 'value' }>, Set<{ x: number }>][];
            };
          },
          ['b', 'c', number, 0, number, 'x']
        >
      ).toEqualTypeOf<'value' | undefined>();
    });

    test('nested without optional', () => {
      expectTypeOf(
        {} as Value<
          {
            a: { b: { c: ['value'] } };
          },
          ['a', 'b', 'c', 0]
        >
      ).toEqualTypeOf<'value'>();
    });

    test('nested with optional', () => {
      expectTypeOf(
        {} as Value<
          {
            a: { b?: { c: ['value'] } };
          },
          ['a', 'b', 'c', 0]
        >
      ).toEqualTypeOf<'value' | undefined>();
    });

    test('nested with record', () => {
      expectTypeOf(
        {} as Value<
          {
            a: { b: Record<string, ['value']> };
          },
          ['a', 'b', 'c', 0]
        >
      ).toEqualTypeOf<'value' | undefined>();
    });
  });

  describe('Path with constraint', () => {
    test('optional path', () => {
      expectTypeOf({} as Path<{ a: number; b?: number; c: number | undefined }, true>).toEqualTypeOf<['b'] | 'b'>();
    });
  });
});
