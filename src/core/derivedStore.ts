import { CalculationHelper } from '@lib/calculationHelper';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/propAccess';
import { get, set } from '@lib/propAccess';
import type { Cancel, Selector, Update, Use } from './commonTypes';
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
    protected derivedFrom?: { store: Store<any>; selectors: (Selector<any, any> | string)[] }
  ) {
    super(undefined as T);
  }

  get(): T {
    if (!this.valid) {
      this.calculationHelper.execute();
    }

    return super.get();
  }

  update(update: Update<T>): void {
    if (this.derivedFrom && this.derivedFrom.selectors.every((selector) => typeof selector === 'string')) {
      const path = this.derivedFrom.selectors.join('.');

      if (update instanceof Function) {
        const before = get<any, any>(this.derivedFrom.store, path) as T;
        update = update(before);
      }

      this.derivedFrom.store.update((before: any) => set<any, any>(before, path, update));
    } else {
      throw new Error('Can only updated computed stores that are derived from other stores using string selectors');
    }
  }

  map<S>(selector: Selector<T, S>): DerivedStore<S>;
  map<P extends Path<T>>(selector: P): DerivedStore<Value<T, P>>;
  map(_selector: string | Selector<T, any>): DerivedStore<any> {
    const selector = makeSelector(_selector);

    const derivedFrom = this.derivedFrom ?? { store: this, selectors: [] };
    const newDerivedFrom = { ...derivedFrom, selectors: derivedFrom.selectors.concat(_selector) };

    return new DerivedStore(({ use }) => {
      return selector(use(this));
    }, newDerivedFrom);
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
