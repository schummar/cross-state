import { fromExtendedJsonString, toExtendedJsonString } from '@lib/extendedJson';
import type { Location } from '@react/url/urlContext';

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

export function parseLocation(location: Location): URL {
  if (typeof location !== 'string') {
    location = `${location.pathname}${location.search}${location.hash}`;
  }

  return new URL(location, window.location.origin);
}

export function createStorageKey(id: string, key: string) {
  return `cross-state:url:${id}:${key}`;
}
