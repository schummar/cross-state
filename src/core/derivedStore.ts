import { CalculationHelper } from '@lib/calculationHelper';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/propAccess';
import { set } from '@lib/propAccess';
import type { Cancel, Selector, Update, Use } from './commonTypes';
import type { StoreOptions } from './store';
import { Store } from './store';

export class DerivedStore<T> extends Store<T> {
  calculationHelper = new CalculationHelper({
    calculate: ({ use }) => {
      const value = this.calculate.apply({ use }, [{ use }]);
      this.valid = true;
      super.update(value);
    },

    addEffect: this.addEffect,
    getValue: () => this.value,
    onInvalidate: this.invalidate,
  });

  protected valid = false;
  protected check?: () => void;
  protected cancel?: Cancel;

  constructor(
    protected calculate: (this: { use: Use }, fns: { use: Use }) => T,
    protected readonly options: StoreOptions = {},
    protected derivedFrom?: { store: Store<any>; selectors: (Selector<any, any> | string)[] }
  ) {
    super(undefined as T);
  }

  get(): T {
    this.calculationHelper.check();

    if (!this.valid) {
      this.calculationHelper.execute();
    }

    return super.get();
  }

  update(update: Update<T>): void {
    if (this.derivedFrom && this.derivedFrom.selectors.every((selector) => typeof selector === 'string')) {
      const path = this.derivedFrom.selectors.join('.');

      if (update instanceof Function) {
        const before = this.get();
        update = update(before);
      }

      this.derivedFrom.store.update((before: any) => set<any, any>(before, path, update));
    } else {
      throw new Error('Can only updated computed stores that are derived from other stores using string selectors');
    }
  }

  protected invalidate() {
    this.valid = false;

    if (this.isActive) {
      this.calculationHelper.execute();
    }
  }
}

function _derivedStore<T>(calculate: (this: { use: Use }, fns: { use: Use }) => T, options?: StoreOptions) {
  return new DerivedStore(calculate, options);
}

export const derivedStore = Object.assign(_derivedStore, {});
