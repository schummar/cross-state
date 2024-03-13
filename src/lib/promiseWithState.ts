import isPromise from '@lib/isPromise';
import { type ErrorState, type PendingState, type ValueState } from './cacheState';
import { type MaybePromise } from './maybePromise';

export class PromiseWithState<T> extends Promise<T> {
  static get [Symbol.species]() {
    return Promise;
  }

  static override resolve(): PromiseWithState<void>;

  static override resolve<T>(value: MaybePromise<T>): PromiseWithState<T>;

  static override resolve<T>(value?: MaybePromise<T>) {
    return new PromiseWithState<T>(value as MaybePromise<T>);
  }

  static override reject<T = never>(error: unknown) {
    return new PromiseWithState<T>(Promise.reject(error), { status: 'error', error });
  }

  constructor(
    value: MaybePromise<T>,
    public state: ValueState<T> | ErrorState | PendingState = { status: 'pending' },
  ) {
    super((resolve) => resolve(value));

    if (isPromise(value)) {
      value
        .then((value) => {
          this.state = { status: 'value', value: value };
        })
        .catch((error) => {
          this.state = { status: 'error', error };
        });
    } else {
      this.state = { status: 'value', value: value };
    }
  }
}
