import { fromExtendedJsonString, toExtendedJsonString } from '@lib/extendedJson';

export function defaultDeserializer<T>(value: string): T {
  if (value === undefined) {
    return undefined as T;
  }

  try {
    return fromExtendedJsonString(value) as T;
  } catch {
    return undefined as T;
  }
}

export function defaultSerializer<T>(value: T): string {
  return toExtendedJsonString(value);
}

export function normalizePath<T>(path: string | T): string | T {
  if (typeof path === 'string') {
    return path.replace(/^\//g, '').replace(/\/$/g, '');
  }
  return path;
}
