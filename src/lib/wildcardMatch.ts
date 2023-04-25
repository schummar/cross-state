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

export function getWildCardMatches(object: any, path: KeyType[] | string): Record<KeyType, any> {
  const matches: Record<KeyType, any> = {};
  const [first, ...rest] = castArrayPath(path);

  if (first === undefined) {
    return object;
  }

  if (!(object instanceof Object)) {
    return {};
  }

  if (first === '*') {
    for (const [key, value] of Object.entries(object)) {
      matches[key] = getWildCardMatches(value, rest);
    }
  } else {
    matches[first] = getWildCardMatches(object[first], rest);
  }

  return matches;
}
