import { isPlainObject } from '@lib/helpers';

export function hash(value: unknown): string {
  if (value instanceof Set) {
    return `s[${[...value].map(hash).sort().join(',')}]`;
  }

  if (value instanceof Map) {
    return `m[${[...value.entries()].map(hash).sort().join(',')}]`;
  }

  if (Array.isArray(value)) {
    return `[${value.map(hash).join(',')}]`;
  }

  if (isPlainObject(value)) {
    return `o[${Object.entries(value).map(hash).sort().join(',')}]`;
  }

  return JSON.stringify(value);
}
