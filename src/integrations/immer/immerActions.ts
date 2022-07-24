import type { Draft, nothing } from 'immer';
import { produce } from 'immer';
import type { AtomicStore } from '../../core/atomicStore';

export const immerActions = {
  immerUpdate<T>(
    this: AtomicStore<T>,
    recipe: (draft: Draft<T>) => void | Draft<T> | (Draft<T> extends undefined ? typeof nothing : never) | undefined
  ) {
    this.update(produce(recipe));
  },
};
