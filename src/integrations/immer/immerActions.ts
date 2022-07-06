import type { Draft } from 'immer';
import { produce } from 'immer';
import type { Nothing } from 'immer/dist/internal';
import type { AtomicStore } from '../../core/atomicStore';

export const immerActions = {
  update<T>(
    this: AtomicStore<T>,
    recipe: (draft: Draft<T>) => void | Draft<T> | (Draft<T> extends undefined ? Nothing : never) | undefined
  ) {
    this.set((value) => produce(value, recipe));
  },
};
