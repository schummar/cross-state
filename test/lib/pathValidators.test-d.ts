import type {
  AnyPath,
  ValidOptionalPath,
  ValidPath,
  ValidSettablePath,
  ValidWildcardPath,
  Value,
} from '../../src/lib/path';
import { matches, type MatchedPath } from '../../src/lib/wildcardMatch';
import type { ValidationContext } from '../../src/react/form/form';
import { describe, expectTypeOf, test } from 'vite-plus/test';

type Accepts<V, P> = [P] extends [V] ? true : false;

type Shape =
  | { kind: 'circle'; r: number; at: Date }
  | { kind: 'rect'; w: number; h?: number; tags: string[] };

interface Plain {
  a: number;
  b?: string;
  c: number | undefined;
  nested: { x: { y: { z: { w: { v: number } } } }; arr: { id: string; n?: number[] }[] };
  rec: Record<string, { v: number; o?: { p: boolean } }>;
  tup: [number, { q: string }];
  m: Map<string, { k: number }>;
  s: Set<number>;
  u: Shape;
  shapes: Shape[];
  e: {};
  opt?: { deep?: { deeper: string } };
  nul: { n: number } | null;
  d: Date;
  idx: { [k: string]: number; fixed: number };
}

type Some = Plain | Plain[] | Record<string, Plain> | { wrap: Plain } | string | undefined;

interface AllOptional {
  x?: number;
  child?: { y?: number; z: number };
  list: { q?: number }[];
  m: Map<string, number>;
  rec: Record<string, { r?: 1 }>;
}

describe('path validators accept', () => {
  test('paths through every kind of value', () => {
    type Valid =
      | ''
      | 'a'
      | 'b'
      | 'nested.x.y.z.w.v'
      | `nested.arr.${number}.n.${number}`
      | 'rec.any.o.p'
      | 'tup.1.q'
      | 'm.key.k'
      | 's.0'
      | 'u.r'
      | 'u.tags.0'
      | `shapes.${number}.kind`
      | 'opt.deep.deeper'
      | 'nul.n'
      | 'idx.fixed'
      | 'idx.other'
      | readonly ['nested', 'arr', 0, 'id'];
    expectTypeOf<Accepts<ValidPath<Plain, Valid>, Valid>>().toEqualTypeOf<true>();
    expectTypeOf<
      Accepts<
        ValidPath<Some, `0.${Exclude<Extract<Valid, string>, ''>}`>,
        `0.${Exclude<Extract<Valid, string>, ''>}`
      >
    >().toEqualTypeOf<true>();
  });

  test('per mode', () => {
    expectTypeOf<
      Accepts<
        ValidOptionalPath<AllOptional, 'x' | 'child.y' | `list.${number}.q` | 'm.a' | 'rec.a'>,
        'x' | 'child.y' | `list.${number}.q` | 'm.a' | 'rec.a'
      >
    >().toEqualTypeOf<true>();
    expectTypeOf<
      Accepts<
        ValidSettablePath<{ o?: { x?: number; y?: { z: number } } }, 'o.x' | 'o.y.z'>,
        'o.x' | 'o.y.z'
      >
    >().toEqualTypeOf<true>();
    expectTypeOf<
      Accepts<
        ValidWildcardPath<Plain, 'nested.arr.*.id' | '*.*' | 'rec.*.o.p' | 'm.*' | 's.*'>,
        'nested.arr.*.id' | '*.*' | 'rec.*.o.p' | 'm.*' | 's.*'
      >
    >().toEqualTypeOf<true>();
  });

  test('template literal and any paths', () => {
    expectTypeOf<
      Accepts<ValidPath<Plain, `shapes.${number}.r`>, `shapes.${number}.r`>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      Accepts<ValidPath<Plain, `rec.${string}.v`>, `rec.${string}.v`>
    >().toEqualTypeOf<true>();
    expectTypeOf<Accepts<ValidPath<{ a: any }, 'a.b.c'>, 'a.b.c'>>().toEqualTypeOf<true>();
  });
});

describe('path validators reject', () => {
  test('unknown keys', () => {
    expectTypeOf<Accepts<ValidPath<Plain, 'zzz'>, 'zzz'>>().toEqualTypeOf<false>();
    expectTypeOf<Accepts<ValidPath<Plain, 'nested.x.q'>, 'nested.x.q'>>().toEqualTypeOf<false>();
    expectTypeOf<Accepts<ValidPath<Plain, 'tup.2'>, 'tup.2'>>().toEqualTypeOf<false>();
    expectTypeOf<Accepts<ValidPath<Plain, 'a' | 'zz'>, 'a' | 'zz'>>().toEqualTypeOf<false>();
    expectTypeOf<
      Accepts<ValidPath<Plain, readonly ['shapes', '0']>, readonly ['shapes', '0']>
    >().toEqualTypeOf<false>();
  });

  test('paths into leaves and sets', () => {
    expectTypeOf<Accepts<ValidPath<Plain, 'd.getTime'>, 'd.getTime'>>().toEqualTypeOf<false>();
    expectTypeOf<Accepts<ValidPath<Plain, 's.0.x'>, 's.0.x'>>().toEqualTypeOf<false>();
  });

  test('empty segments', () => {
    expectTypeOf<Accepts<ValidPath<Plain, 'a.'>, 'a.'>>().toEqualTypeOf<false>();
    expectTypeOf<Accepts<ValidPath<Plain, 'rec..v'>, 'rec..v'>>().toEqualTypeOf<false>();
  });

  test('specific keys of an object whose keys are all optional', () => {
    type T = Partial<{ a: { b: Record<string, number> } }>;
    expectTypeOf<Accepts<ValidWildcardPath<T, 'a.b.*'>, 'a.b.*'>>().toEqualTypeOf<true>();
    expectTypeOf<Accepts<ValidWildcardPath<T, 'a.b.x'>, 'a.b.x'>>().toEqualTypeOf<false>();
  });

  test('per mode', () => {
    expectTypeOf<Accepts<ValidOptionalPath<Plain, 'a'>, 'a'>>().toEqualTypeOf<false>();
    expectTypeOf<Accepts<ValidOptionalPath<Plain, ''>, ''>>().toEqualTypeOf<false>();
    expectTypeOf<
      Accepts<ValidSettablePath<{ o?: { a: 1; b: 2 } }, 'o.a'>, 'o.a'>
    >().toEqualTypeOf<false>();
    expectTypeOf<Accepts<ValidWildcardPath<Plain, 'rec.foo'>, 'rec.foo'>>().toEqualTypeOf<false>();
    expectTypeOf<Accepts<ValidWildcardPath<Plain, 'd.*'>, 'd.*'>>().toEqualTypeOf<false>();
  });
});

describe('path validators at call sites', () => {
  function get<T, const P extends AnyPath>(_object: T, _path: ValidPath<T, P>): Value<T, P> {
    return null!;
  }
  const plain = {} as Plain;

  test('infer the path', () => {
    expectTypeOf(get(plain, 'a')).toEqualTypeOf<number>();
    expectTypeOf(get(plain, 'opt.deep.deeper')).toEqualTypeOf<string | undefined>();
    expectTypeOf(get(plain, ['nested', 'arr', 0, 'id'])).toEqualTypeOf<string | undefined>();
    expectTypeOf(get(plain, '')).toEqualTypeOf<Plain>();
  });

  test('keep literal paths from a ternary in an object property', () => {
    function withPath<const P extends AnyPath>(_options: { path: ValidPath<Plain, P> }): P {
      return null!;
    }
    const flag = Math.random() > 0.5;

    expectTypeOf(withPath({ path: flag ? 'nested.x' : 'opt.deep' })).toEqualTypeOf<
      'nested.x' | 'opt.deep'
    >();
    // @ts-expect-error not a path of Plain
    withPath({ path: flag ? 'nested.x' : 'opt.nope' });
  });

  test('suggest the valid segments', () => {
    // @ts-expect-error not a key of `nested`
    get(plain, 'nested.arrr');
    expectTypeOf<ValidPath<Plain, 'nested.arrr'>>().toEqualTypeOf<'nested.arr' | 'nested.x'>();
    expectTypeOf<ValidOptionalPath<{ a: string; b?: string }, 'a'>>().toEqualTypeOf<'b'>();
  });

  test('offer the next segments of a valid path', () => {
    expectTypeOf<ValidPath<Plain, 'nested'>>().toEqualTypeOf<
      'nested' | 'nested.arr' | 'nested.x'
    >();
  });

  test('pass a generic path on', () => {
    function wrapper<TDraft, const TPath extends string>(
      draft: TDraft,
      path: ValidPath<TDraft, TPath>,
    ): Value<TDraft, TPath> {
      return get(draft, path);
    }

    expectTypeOf(wrapper(plain, 'nested.x')).toEqualTypeOf<Plain['nested']['x']>();
  });
});

describe('form validation helpers', () => {
  const draft = {} as Plain;

  test('matches yields concrete names and the matched values', () => {
    expectTypeOf(matches(draft, 'nested.arr.*.id')).toEqualTypeOf<
      [name: MatchedPath, value: string][]
    >();
    // @ts-expect-error not a path of Plain
    matches(draft, 'nested.arr.*.idd');
  });

  test('fieldError checks the field name', () => {
    const { fieldError } = {} as ValidationContext<Plain, Plain>;
    fieldError('nested.x', 'required');
    fieldError(matches(draft, 'shapes.*.kind')[0]![0], 'required');
    // @ts-expect-error not a path of Plain
    fieldError('nested.q', 'required');
  });
});
