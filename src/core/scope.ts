export class Scope<T> {
  constructor(public readonly defaultValue: T) {
    if ('Provider' in this && this.Provider instanceof Function) {
      this.Provider = this.Provider.bind(this) as any;
    }
  }
}

export function createScope<T>(defaultValue: T): Scope<T> {
  return new Scope(defaultValue);
}
