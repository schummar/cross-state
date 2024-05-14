import { autobind } from '@lib/autobind';

export class Scope<T> {
  constructor(public readonly defaultValue: T) {
    autobind(Scope);
  }
}

export function createScope<T>(defaultValue: T): Scope<T> {
  return new Scope(defaultValue);
}
