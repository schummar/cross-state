import { produce } from 'immer';
import type { BaseStore } from '../../core/types';
import type { Draft} from 'immer';

export const immerActions = {
  update<T>(this: BaseStore<T>, recipe: (draft: Draft<T>) => Draft<T> | void | undefined) {
    this.set((value) => produce(value, recipe));
  },
};
