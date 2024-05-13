import { isObject } from '@lib/helpers';
import type { Update } from '../core/commonTypes';
import { flatClone } from './clone';
import type { GetKeys, KeyType, Path, PathAsArray, SettablePath, Value } from './path';
import type { IsAny, Object_, StringToArrayPath } from '@lib/typeHelpers';

export function castArrayPath(path: string | KeyType[]): KeyType[] {
  if (Array.isArray(path)) {
    return path;
  }

  if (path === '') {
    return [];
  }

  return (path as string).split('.');
}

export function get<T, P extends Path<T>>(object: T, path: P): Value<T, P> {
  const _path = castArrayPath(path as any);
  const [first, ...rest] = _path;

  if (first === undefined || !object) {
    return object as Value<T, P>;
  }

  if (object instanceof Map) {
    return get(object.get(first), rest);
  }

  if (object instanceof Set) {
    return get(Array.from(object)[Number(first)], rest);
  }

  if (isObject(object)) {
    return get(object[first as keyof T], rest as any) as Value<T, P>;
  }

  throw new Error(`Could not get ${path} of ${object}`);
}

export function set<T, P extends SettablePath<T>>(
  object: T,
  path: P,
  value: Update<Value<T, P>>,
  rootPath: string | readonly KeyType[] = path,
): T {
  const _path = castArrayPath(path as any);
  const [first, ...rest] = _path;

  if (first === undefined) {
    if (value instanceof Function) {
      return value(object as Value<T, P>) as T;
    }

    return value as T;
  }

  if (object instanceof Map) {
    const copy = flatClone(object);
    const child = copy.get(first);
    copy.set(first, set(child, rest, value, rootPath));
    return copy;
  }

  if (object instanceof Set) {
    const copy = [...object];
    const child = copy[Number(first)];
    copy[Number(first)] = set(child, rest, value, rootPath);
    return new Set(copy) as any;
  }

  if (isObject(object) || object === undefined) {
    const copy = flatClone(object ?? ({} as T));
    copy[first as keyof T] = set(copy[first as keyof T], rest as any, value, rootPath);
    return copy;
  }

  throw new Error(`Could not set ${path} of ${object}`);
}

export function remove<T, P extends Path<T, true>>(object: T, path: P): T {
  const _path = castArrayPath(path as any);

  if (_path.length === 0) {
    return undefined as any;
  }

  const parentPath = _path.slice(0, -1);
  const key = _path[_path.length - 1];

  const parent = flatClone(get(object, parentPath as any));

  if (parent instanceof Map) {
    parent.delete(key);
  } else if (parent instanceof Set) {
    const value = Array.from(parent)[Number(key)];
    parent.delete(value);
  } else {
    delete parent[key as keyof typeof parent];
  }

  return set(object, parentPath as any, parent);
}

export function join(a: string, b: string): string {
  return [a, b].filter(Boolean).join('.');
}
