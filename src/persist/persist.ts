import type { Store } from '@';
import { store } from '@';
import { diff } from '@lib/diff';
import type { WildcardPath, WildcardPathAsArray } from '@lib/path';
import { castArrayPath } from '@lib/propAccess';

export interface PersistOptions<T> {
  paths?:
    | WildcardPath<T>[]
    | {
        path: WildcardPath<T>;
        throttleMs?: number;
      }[];
  throttleMs?: number;
}

interface PersistOptionsNormalized<T> extends PersistOptions<T> {
  paths: {
    path: WildcardPathAsArray<T>;
    throttleMs?: number;
  }[];
}

class Persist<T> {
  options: PersistOptionsNormalized<T>;

  constructor(public readonly store: Store<T>, options: PersistOptions<T> = {}) {
    this.options = {
      paths: (options.paths ?? [])
        .map<{
          path: WildcardPathAsArray<T>;
          throttleMs?: number;
        }>((p) =>
          typeof p === 'string' || Array.isArray(p)
            ? {
                path: castArrayPath(p as any) as WildcardPathAsArray<T>,
              }
            : {
                path: castArrayPath(p.path as any) as WildcardPathAsArray<T>,
                throttleMs: p.throttleMs,
              }
        )
        .sort((a, b) => b.path.length - a.path.length),

      throttleMs: options.throttleMs,
    };

    console.log(this.options);

    this.start();
  }

  start() {
    let committed = this.store.get();

    this.store.sub((value) => {
      const [patches] = diff(committed, value);
      committed = value;

      console.log(patches);
    });
  }

  stop() {
    console.log('stop');
  }
}

export function persist<T>(store: Store<T>, options?: PersistOptions<T>): Persist<T> {
  return new Persist<T>(store, options);
}

const s = store({
  a: 1,
  b: { c: 2, d: 3 },
  e: new Map([
    [1, 1],
    [2, 2],
  ]),
});
const p = persist(s, {
  paths: ['e', 'b.c', 'e.*'],
});

s.set('a', 2);
s.set('b', { c: 3, d: 4 });
s.set(['b', 'c'], 4);
s.set(
  'e',
  new Map([
    [1, 2],
    [2, 3],
  ])
);
s.set(['e', 1], 3);
