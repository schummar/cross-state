export class Deferred<T = void> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  reject: (reason?: any) => void = () => undefined;

  constructor() {
    void Object.defineProperty(Deferred, Symbol.species, {
      value: Promise,
    });

    const that = {};

    super((resolve, reject) => {
      Object.assign(that, { resolve, reject });
    });

    void Object.assign(this, that);
  }
}
