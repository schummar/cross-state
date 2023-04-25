import { describe, expectTypeOf, test } from 'vitest';
import type {
  GetKeys,
  Path,
  PathAsArray,
  Value,
  WildcardMatch,
  WildcardValue,
} from '../../src/lib/path';

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
      expectTypeOf({} as Path<number[]>).toEqualTypeOf<[number] | `${number}`>();
    });

    test('tuple', () => {
      expectTypeOf({} as Path<[number, string]>).toEqualTypeOf<[0] | [1] | '0' | '1'>();
    });

    test('map', () => {
      expectTypeOf({} as Path<Map<string, number>>).toEqualTypeOf<[string] | string>();
    });

    test('set', () => {
      expectTypeOf({} as Path<Set<number>>).toEqualTypeOf<[number] | `${number}`>();
    });

    test('no simplified path for string containing dots', () => {
      expectTypeOf({} as Path<{ 'a.b': { c: number }; d: number }>).toEqualTypeOf<
        ['a.b'] | ['a.b', 'c'] | ['d'] | 'd'
      >();
    });

    test('nested', () => {
      expectTypeOf(
        {} as PathAsArray<
          {
            a: number;
            b: {
              c: [Map<number, { x: number }>, Set<{ x: number }>][];
            };
          },
          false,
          10
        >,
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

    test('path longer than MaxDepth', () => {
      expectTypeOf(
        {} as PathAsArray<{ a: { a: { a: 1 } }; b: { b: { b: { b: 1 } } } }, false, 3>,
      ).toEqualTypeOf<
        | ['a']
        | ['a', 'a']
        | ['a', 'a', 'a']
        | ['b']
        | ['b', 'b']
        | ['b', 'b', 'b']
        | ['b', 'b', 'b', ...string[]]
      >();
    });
  });

  describe('Value', () => {
    test('object', () => {
      expectTypeOf({} as Value<{ x: 'value'; y: 'value' }, 'x'>).toEqualTypeOf<'value'>();
    });

    test('record', () => {
      expectTypeOf({} as Value<Record<string, 'value'>, ['x']>).toEqualTypeOf<
        'value' | undefined
      >();
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
        >,
      ).toEqualTypeOf<'value' | undefined>();
    });

    test('nested without optional', () => {
      expectTypeOf(
        {} as Value<
          {
            a: { b: { c: ['value'] } };
          },
          ['a', 'b', 'c', 0]
        >,
      ).toEqualTypeOf<'value'>();
    });

    test('nested with optional', () => {
      expectTypeOf(
        {} as Value<
          {
            a: { b?: { c: ['value'] } };
          },
          ['a', 'b', 'c', 0]
        >,
      ).toEqualTypeOf<'value' | undefined>();
    });

    test('nested with record', () => {
      expectTypeOf(
        {} as Value<
          {
            a: { b: Record<string, ['value']> };
          },
          ['a', 'b', 'c', 0]
        >,
      ).toEqualTypeOf<'value' | undefined>();
    });
  });

  describe('Path with constraint', () => {
    test('optional path', () => {
      expectTypeOf(
        {} as Path<{ a: number; b?: number; c: number | undefined }, true>,
      ).toEqualTypeOf<['b'] | 'b'>();
    });
  });

  describe('Wildcard Paths', () => {
    test('WildcardValue', () => {
      expectTypeOf({} as WildcardValue<{ a: 1; b: 2 }, 'a'>).toEqualTypeOf<1>();
      expectTypeOf({} as WildcardValue<{ a: 1; b: 2 }, 'c'>).toEqualTypeOf<unknown>();
      expectTypeOf({} as WildcardValue<{ a: 1; b: 2 }, '*'>).toEqualTypeOf<1 | 2>();

      expectTypeOf({} as WildcardValue<Record<string, 1>, 'a'>).toEqualTypeOf<1 | undefined>();
      expectTypeOf({} as WildcardValue<Record<string, 1>, '*'>).toEqualTypeOf<1>();

      expectTypeOf({} as WildcardValue<number[], '0'>).toEqualTypeOf<number | undefined>();
      expectTypeOf({} as WildcardValue<number[], '*'>).toEqualTypeOf<number>();

      expectTypeOf({} as WildcardValue<[1, 2, 3], '0'>).toEqualTypeOf<1>();
      expectTypeOf(undefined as WildcardValue<[1, 2, 3], '3'>).toEqualTypeOf<undefined>();
      expectTypeOf({} as WildcardValue<[1, 2, 3], '*'>).toEqualTypeOf<1 | 2 | 3>();

      expectTypeOf({} as WildcardValue<Map<string, 1>, 'a'>).toEqualTypeOf<1 | undefined>();
      expectTypeOf({} as WildcardValue<Map<string, 1>, '*'>).toEqualTypeOf<1>();

      expectTypeOf({} as WildcardValue<Set<1>, '0'>).toEqualTypeOf<1 | undefined>();
      expectTypeOf({} as WildcardValue<Set<1>, '*'>).toEqualTypeOf<1>();
    });

    test('WildcardMatch', () => {
      expectTypeOf({} as WildcardMatch<'a', 'a'>).toEqualTypeOf<true>();
      expectTypeOf({} as WildcardMatch<'a', 'b'>).toEqualTypeOf<false>();
      expectTypeOf({} as WildcardMatch<'a', '*'>).toEqualTypeOf<true>();

      expectTypeOf({} as WildcardMatch<'a.b.c', 'a.b.c'>).toEqualTypeOf<true>();
      expectTypeOf({} as WildcardMatch<'a.b.c', 'a.b.d'>).toEqualTypeOf<false>();
      expectTypeOf({} as WildcardMatch<'a.b.c', 'a.*.c'>).toEqualTypeOf<true>();
      expectTypeOf({} as WildcardMatch<'a.b.c', 'a.*.d'>).toEqualTypeOf<false>();
      expectTypeOf({} as WildcardMatch<'a.b.c', 'a.*.*'>).toEqualTypeOf<true>();
      expectTypeOf({} as WildcardMatch<'a.b.c', '*.*.*'>).toEqualTypeOf<true>();
    });
  });
});
