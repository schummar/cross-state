import type {
  GetKeys,
  ValidOptionalPath,
  ValidPath,
  ValidSettablePath,
  ValidWildcardPath,
  Value,
  WildcardMatch,
  WildcardValue,
} from '../../src/lib/path';
import { describe, expectTypeOf, test } from 'vite-plus/test';

// `P` passes the check: every member of `P` is a valid path
type Accepts<V, P> = [P] extends [V] ? true : false;

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

  describe('ValidPath', () => {
    test('object', () => {
      type T = { x: number; y: number };
      expectTypeOf<
        Accepts<
          ValidPath<T, '' | 'x' | 'y' | readonly [] | readonly ['x']>,
          '' | 'x' | 'y' | readonly [] | readonly ['x']
        >
      >().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<T, 'z'>, 'z'>>().toEqualTypeOf<false>();
    });

    test('record', () => {
      type T = Record<string, number>;
      expectTypeOf<
        Accepts<ValidPath<T, 'a' | string | readonly ['a']>, 'a' | string | readonly ['a']>
      >().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<T, 'a.b'>, 'a.b'>>().toEqualTypeOf<false>();
    });

    test('array', () => {
      type T = number[];
      expectTypeOf<
        Accepts<ValidPath<T, '0' | `${number}` | readonly [1]>, '0' | `${number}` | readonly [1]>
      >().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<T, 'x'>, 'x'>>().toEqualTypeOf<false>();
      expectTypeOf<Accepts<ValidPath<T, readonly ['0']>, readonly ['0']>>().toEqualTypeOf<false>();
    });

    test('tuple', () => {
      type T = [number, string];
      expectTypeOf<
        Accepts<ValidPath<T, '0' | '1' | readonly [1]>, '0' | '1' | readonly [1]>
      >().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<T, '2'>, '2'>>().toEqualTypeOf<false>();
    });

    test('map', () => {
      type T = Map<string, { x: number }>;
      expectTypeOf<
        Accepts<ValidPath<T, 'a' | 'a.x' | readonly ['a', 'x']>, 'a' | 'a.x' | readonly ['a', 'x']>
      >().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<T, 'a.y'>, 'a.y'>>().toEqualTypeOf<false>();
    });

    test('set', () => {
      type T = Set<{ x: number }>;
      expectTypeOf<
        Accepts<ValidPath<T, '0' | readonly [0]>, '0' | readonly [0]>
      >().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<T, '0.x'>, '0.x'>>().toEqualTypeOf<false>();
    });

    test('keys containing dots only work in array paths', () => {
      type T = { 'a.b': { c: number }; d: number };
      expectTypeOf<
        Accepts<ValidPath<T, readonly ['a.b', 'c']>, readonly ['a.b', 'c']>
      >().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<T, 'a.b.c'>, 'a.b.c'>>().toEqualTypeOf<false>();
    });

    test('nested', () => {
      type T = { a: number; b: { c: [Map<number, { x: number }>, Set<{ x: number }>][] } };
      type Valid =
        | readonly ['b', 'c', number, 0, number, 'x']
        | readonly ['b', 'c', number, 1, number]
        | `b.c.${number}.0.${number}.x`
        | 'b.c.0.1.2';
      expectTypeOf<Accepts<ValidPath<T, Valid>, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<T, 'b.c.0.1.2.x'>, 'b.c.0.1.2.x'>>().toEqualTypeOf<false>();
    });

    test('any depth', () => {
      type T = { a: { a: { a: { a: { a: { a: { b: 1 } } } } } } };
      expectTypeOf<Accepts<ValidPath<T, 'a.a.a.a.a.a.b'>, 'a.a.a.a.a.a.b'>>().toEqualTypeOf<true>();
      expectTypeOf<
        Accepts<ValidPath<T, 'a.a.a.a.a.a.c'>, 'a.a.a.a.a.a.c'>
      >().toEqualTypeOf<false>();
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

  describe('ValidOptionalPath', () => {
    test('only optional keys at the end', () => {
      type T = { a: number; b?: number; c: number | undefined; d: { e?: 1 } };
      expectTypeOf<Accepts<ValidOptionalPath<T, 'b' | 'd.e'>, 'b' | 'd.e'>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidOptionalPath<T, 'a'>, 'a'>>().toEqualTypeOf<false>();
      expectTypeOf<Accepts<ValidOptionalPath<T, 'c'>, 'c'>>().toEqualTypeOf<false>();
      expectTypeOf<Accepts<ValidOptionalPath<T, ''>, ''>>().toEqualTypeOf<false>();
    });
  });

  describe('Wildcard Paths', () => {
    test('ValidWildcardPath', () => {
      type T = { a: { x: string } };
      type Valid = '' | '*' | '*.*' | '*.x' | 'a' | 'a.*' | 'a.x';
      expectTypeOf<Accepts<ValidWildcardPath<T, Valid>, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidWildcardPath<T, 'a.y'>, 'a.y'>>().toEqualTypeOf<false>();

      type R = Record<string, { x: string }>;
      type ValidR = '' | '*' | '*.*' | '*.x';
      expectTypeOf<Accepts<ValidWildcardPath<R, ValidR>, ValidR>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidWildcardPath<R, 'a.x'>, 'a.x'>>().toEqualTypeOf<false>();
    });

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

      expectTypeOf(
        {} as WildcardValue<{ a: Record<string, { b: { c: string }[] }> }, 'a.*.b.*.c'>,
      ).toEqualTypeOf<string>();
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

  describe('ValidSettablePath', () => {
    test('keys that can be set on an undefined parent', () => {
      expectTypeOf<Accepts<ValidSettablePath<{}, ''>, ''>>().toEqualTypeOf<true>();
      expectTypeOf<
        Accepts<ValidSettablePath<{ a: 1 } | undefined, 'a'>, 'a'>
      >().toEqualTypeOf<true>();
      expectTypeOf<
        Accepts<ValidSettablePath<{ a: 1; b: 2 } | undefined, 'a'>, 'a'>
      >().toEqualTypeOf<false>();
      expectTypeOf<
        Accepts<ValidSettablePath<{ a: 1; b?: 2 } | undefined, 'a'>, 'a'>
      >().toEqualTypeOf<true>();

      type T = { a1?: { b1: { c: 1 }; b2?: 1 }; a2?: 1 };
      type Valid = 'a1' | 'a1.b1' | 'a1.b1.c' | 'a2';
      expectTypeOf<Accepts<ValidSettablePath<T, Valid>, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidSettablePath<T, 'a1.b2'>, 'a1.b2'>>().toEqualTypeOf<false>();
    });

    test('recursive optional type', () => {
      interface Node {
        value?: number;
        child?: Node;
      }

      type Valid = 'child.child.child.value' | readonly ['child', 'child', 'value'];
      expectTypeOf<Accepts<ValidSettablePath<Node, Valid>, Valid>>().toEqualTypeOf<true>();
    });
  });

  describe('leaves', () => {
    interface Draft {
      date: Date;
      optionalDate?: Date;
      fn: () => void;
      promise: Promise<string>;
      regex: RegExp;
      bytes: Uint8Array;
      file: File;
      controller: AbortController;
      branded: string & { __brand?: 'id' };
      list: { at: Date; n: number }[];
    }

    test('paths end at leaves', () => {
      type Valid =
        | 'date'
        | 'fn'
        | 'promise'
        | 'regex'
        | 'bytes'
        | 'file'
        | 'controller'
        | 'branded';
      expectTypeOf<Accepts<ValidPath<Draft, Valid>, Valid>>().toEqualTypeOf<true>();
      expectTypeOf<
        Accepts<ValidPath<Draft, `list.${number}.at`>, `list.${number}.at`>
      >().toEqualTypeOf<true>();
      expectTypeOf<
        Accepts<ValidPath<Draft, 'date.getTime'>, 'date.getTime'>
      >().toEqualTypeOf<false>();
      expectTypeOf<Accepts<ValidPath<Draft, 'fn.call'>, 'fn.call'>>().toEqualTypeOf<false>();
      expectTypeOf<Accepts<ValidPath<Draft, 'file.size'>, 'file.size'>>().toEqualTypeOf<false>();
      expectTypeOf<
        Accepts<ValidPath<Draft, 'controller.signal'>, 'controller.signal'>
      >().toEqualTypeOf<false>();
      expectTypeOf<
        Accepts<ValidPath<Draft, 'branded.length'>, 'branded.length'>
      >().toEqualTypeOf<false>();
      expectTypeOf<
        Accepts<ValidPath<Draft, 'list.0.at.getTime'>, 'list.0.at.getTime'>
      >().toEqualTypeOf<false>();
    });

    test('wildcard and settable paths end at leaves', () => {
      expectTypeOf<
        Accepts<ValidWildcardPath<Draft, 'list.*.at'>, 'list.*.at'>
      >().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidWildcardPath<Draft, 'date.*'>, 'date.*'>>().toEqualTypeOf<false>();
      expectTypeOf<
        Accepts<ValidSettablePath<Draft, 'date.getTime'>, 'date.getTime'>
      >().toEqualTypeOf<false>();
    });

    test('leaf as root', () => {
      expectTypeOf<Accepts<ValidPath<Date, ''>, ''>>().toEqualTypeOf<true>();
      expectTypeOf<Accepts<ValidPath<Date, 'getTime'>, 'getTime'>>().toEqualTypeOf<false>();
    });

    test('value of a leaf path', () => {
      expectTypeOf({} as Value<Draft, 'list.0.at'>).toEqualTypeOf<Date | undefined>();
      expectTypeOf({} as Value<Draft, 'optionalDate'>).toEqualTypeOf<Date | undefined>();
    });
  });
});
