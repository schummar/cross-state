import { isObject } from '@lib/helpers';
import { type KeyType } from './path';
import { castArrayPath } from './propAccess';

export function wildcardMatch(s: KeyType[] | string, w: KeyType[] | string): boolean {
  if (typeof s === 'string') {
    s = castArrayPath(s);
  }

  if (typeof w === 'string') {
    w = castArrayPath(w);
  }

  return s.length === w.length && s.every((s, i) => w[i] === '*' || s === w[i]);
}

export function getWildCardMatches(
  object: any,
  path: [KeyType, ...KeyType[]] | string,
): Record<KeyType, any> {
  const matches: Record<KeyType, any> = {};
  const [first, second, ...rest] = castArrayPath(path);

  if (first === undefined) {
    throw new Error('Path is empty');
  }

  if (!Array.isArray(object) && !isObject(object)) {
    object = {};
  }

  for (const [key, value] of first !== '*' ? [[first, object[first]]] : Object.entries(object)) {
    if (first !== '*' && first !== key) {
      continue;
    }

    if (second === undefined) {
      matches[key] = value;
      continue;
    }

    for (const [subKey, subValue] of Object.entries(getWildCardMatches(value, [second, ...rest]))) {
      matches[`${key}.${subKey}`] = subValue;
    }
  }

  return matches;
}
