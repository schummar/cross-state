import type { Store } from '@core/store';
import { type Path, type Value } from '@lib/path';
import { create, type Draft } from 'mutative';

export type Mutation<T> = (draft: Draft<T>) => void;

function update<T>(this: Store<T>, mutation: Mutation<T>): void;

function update<T, const P extends Path<T>>(
  this: Store<T>,
  path: P,
  mutation: Mutation<Value<T, P>>,
): void;

function update<T, TPath extends Path<T>>(
  this: Store<T>,
  ...args: [recipe: Mutation<T>] | [path: TPath, mutation: Mutation<Value<T, TPath>>]
) {
  if (args.length === 1) {
    const [mutation] = args;

    this.set((value) => {
      const result = create(value, (draft) => {
        mutation(draft);
      });
      return result;
    });
  } else {
    const [path, mutation] = args;

    this.set(path, (value) => {
      const result = create(value, (draft) => {
        mutation(draft);
      });
      return result;
    });
  }
}

export const mutativeMethods = {
  update,
};
