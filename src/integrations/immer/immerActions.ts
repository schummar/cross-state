import type { Draft } from 'immer';
import { produce } from 'immer';
import type { AtomicStore } from '../../core/atomicStore';

export const immerActions = {
  update<T>(this: AtomicStore<T>, recipe: (draft: Draft<T>) => Draft<T> | void | undefined) {
    this.set((value) => produce(value, recipe));
  },
};
