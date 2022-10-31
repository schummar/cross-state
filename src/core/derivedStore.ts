import { Store } from './store';

export class DerivedStore<T> extends Store<T> {
  protected checks: (() => boolean)[] = [];

  constructor(protected calculate: (fns: { use: <S>(store: Store<S>) => S }) => T) {
    super(undefined as T);
  }
}
