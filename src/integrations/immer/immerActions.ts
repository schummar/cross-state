import type { Draft } from 'immer';
import { produce } from 'immer';
import type { AtomicStoreImpl } from '../../core/atomicStore';

export const immerActions = {
  update<T>(this: AtomicStoreImpl<T>, recipe: (draft: Draft<T>) => Draft<T> | void | undefined) {
    this.set((value) => produce(value, recipe));
  },
};
