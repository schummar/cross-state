import type { Cancel, Use } from './commonTypes';
import { Store } from './store';

export class DerivedStore<T> extends Store<T> {
  protected valid = false;
  protected check?: () => void;
  protected cancel?: Cancel;

  constructor(protected calculate: (this: { use: Use }, fns: { use: Use }) => T) {
    super(undefined as T);

    this.addEffect();
  }

  get(): T {
    if (!this.valid) {
      this.value = this.calculate();
      this.valid = true;
    }

    return this.value;
  }
}
