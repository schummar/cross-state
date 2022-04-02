import { Draft, produce } from 'immer';
import { AtomicStore } from '../types';

export const immerActions = {
  update<T>(this: AtomicStore<T>, recipe: (draft: Draft<T>) => Draft<T> | void | undefined) {
    this.set((value) => produce(value, recipe));
  },
};
