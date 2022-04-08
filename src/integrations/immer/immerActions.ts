import { Draft, produce } from 'immer';
import { BaseStore } from '../../types';

export const immerActions = {
  update<T>(this: BaseStore<T>, recipe: (draft: Draft<T>) => Draft<T> | void | undefined) {
    this.set((value) => produce(value, recipe));
  },
};
