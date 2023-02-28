import type { Draft, nothing } from 'immer';
import { produce } from 'immer';
import type { Store } from '@core/store';

export const immerActions = {
  immerUpdate<T>(
    this: Store<T>,
    recipe: (
      draft: Draft<T>,
    ) => void | Draft<T> | (Draft<T> extends undefined ? typeof nothing : never) | undefined,
  ) {
    this.set(produce(recipe));
  },
};
