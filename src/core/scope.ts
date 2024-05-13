import { autobind } from '@lib/autobind';

export class Scope<T> {
  static {
    /* @__PURE__ */ autobind(Scope);
  }

  constructor(public readonly defaultValue: T) {}
}

export function createScope<T>(defaultValue: T): Scope<T> {
  return new Scope(defaultValue);
}
