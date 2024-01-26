export class Deferred<T = void> extends Promise<T> {
  static get [Symbol.species]() {
    return Promise;
  }

  resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  reject: (reason?: any) => void = () => undefined;

  constructor() {
    const that = {};

    super((resolve, reject) => {
      Object.assign(that, { resolve, reject });
    });

    Object.assign(this, that);
  }
}
