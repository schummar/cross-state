import fastDeepEqual from 'fast-deep-equal';
import produce, { freeze, PatchListener } from 'immer';
import { BaseStore } from './baseStore';

export class Store<T> extends BaseStore<T, [recipe: (draft: T) => void, listener?: PatchListener]> {
  constructor(state: T) {
    super(freeze(state, true), {
      equals: fastDeepEqual,
      update: produce,
      freeze: (state) => freeze(state, true),
    });
  }
}
