import { isPlainObject } from '@lib/helpers';

export interface Hashable {
  [hash](): string;
}

export const hash: unique symbol = Symbol('hash');

function hasHashFunction(value: unknown): value is Hashable {
  return (
    typeof value === 'object' &&
    value !== null &&
    hash in value &&
    typeof (value as any)[hash] === 'function' &&
    (value as any)[hash].length === 0
  );
}

export function simpleHash(value: unknown): string {
  if (hasHashFunction(value)) {
    return value[hash]();
  }

  if (value instanceof Set) {
    return `s[${[...value].map(simpleHash).sort().join(',')}]`;
  }

  if (value instanceof Map) {
    return `m[${[...value.entries()].map(simpleHash).sort().join(',')}]`;
  }

  if (Array.isArray(value)) {
    return `[${value.map(simpleHash).join(',')}]`;
  }

  if (isPlainObject(value)) {
    return `o[${Object.entries(value).map(simpleHash).sort().join(',')}]`;
  }

  return JSON.stringify(value);
}
