export class Scope<T> {
  constructor(public readonly defaultValue: T) {}
}

export function createScope<T>(defaultValue: T): Scope<T> {
  return new Scope(defaultValue);
}
