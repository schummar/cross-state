import type { Draft } from 'immer';
import { produce } from 'immer';
import type { Store } from '@core/store';
import { type Path, type Value } from '@lib/path';

type Recipe<T> = (draft: Draft<T>) => void;

function update<T>(this: Store<T>, recipe: Recipe<T>): void;

function update<T, const P extends Path<T>>(
  this: Store<T>,
  path: P,
  recipe: Recipe<Value<T, P>>,
): void;

function update<T, P extends Path<T>>(
  this: Store<T>,
  ...args: [recipe: Recipe<T>] | [P: P, recipe: Recipe<Value<T, P>>]
) {
  if (args.length === 1) {
    this.set((value) =>
      produce(value, (draft) => {
        args[0](draft);
      }),
    );
  } else {
    this.set(args[0], (value) =>
      produce(value, (draft) => {
        args[1](draft);
      }),
    );
  }
}

export const immerMethods = {
  update,
};
