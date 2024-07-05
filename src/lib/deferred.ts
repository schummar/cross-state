export class Deferred<T = void> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  reject: (reason?: any) => void = () => undefined;

  constructor() {
    Object.defineProperty(Deferred, Symbol.species, {
      value: Promise,
    });

    const that = {};

    super((resolve, reject) => {
      Object.assign(that, { resolve, reject });
    });

    Object.assign(this, that);
  }
}
