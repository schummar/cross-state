import { CalculationHelper } from '@lib/calculationHelper';
import type { Cancel, Update, Use } from './commonTypes';
import { Store } from './store';

export class DerivedStore<T> extends Store<T> {
  calculationHelper = new CalculationHelper({
    calculate: ({ use }) => {
      this.value = this.calculate.apply({ use }, [{ use }]);
    },

    addEffect: this.addEffect,
    getValue: () => this.value,
    onInvalidate: this.invalidate,
  });

  protected valid = false;
  protected check?: () => void;
  protected cancel?: Cancel;

  constructor(protected calculate: (this: { use: Use }, fns: { use: Use }) => T) {
    super(undefined as T);
  }

  get(): T {
    if (!this.valid) {
      this.calculationHelper.execute();
      this.valid = true;
    }

    return this.value;
  }

  update(update: Update<T>): void {
    this.valid = true;
    super.update(update);
  }

  protected invalidate() {
    this.valid = false;

    if (this.isActive) {
      this.calculationHelper.execute();
    }
  }
}

function _derivedStore<T>(calculate: (this: { use: Use }, fns: { use: Use }) => T) {
  return new DerivedStore(calculate);
}

export const derivedStore = Object.assign(_derivedStore, {});
