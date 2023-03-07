export class Callable<Args extends any[], T> extends Function {
  constructor(protected _call: (...args: Args) => T) {
    super('...args', 'return this._call(...args)');

    // eslint-disable-next-line no-constructor-return
    return this.bind(this);
  }
}
