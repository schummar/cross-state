import fastDeepEqual from 'fast-deep-equal';
import { BaseStore } from './baseStore';

export class SimpleStore<T> extends BaseStore<T, [(state: T) => T]> {
  constructor(state: T) {
    super(state, {
      equals: fastDeepEqual,
      update: (state, update) => update(state),
    });
  }
}
