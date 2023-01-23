import type { Update } from '../core/commonTypes';
import { flatClone } from './clone';
import type { Path, Value } from './path';

export function castArrayPath(path: string | KeyType[]): KeyType[] {
  if (Array.isArray(path)) {
    return path as any;
  }

  if (path === '') {
    return [] as any;
  }

  return (path as string).split('.') as any;
}

export function get<T, P extends Path<T>>(obj: T, path: P): Value<T, P> {
  const _path = castArrayPath(path as any);
  const [first, ...rest] = _path;

  if (first === undefined || !obj) {
    return obj as Value<T, P>;
  }

  if (obj instanceof Map) {
    return get(obj.get(first), rest as any);
  }

  if (obj instanceof Set) {
    return get(Array.from(obj)[Number(first)], rest as any);
  }

  if (obj instanceof Object) {
    return get(obj[first as keyof T], rest as any) as Value<T, P>;
  }

  throw new Error(`Could not get ${path} of ${obj}`);
}

export function set<T, P extends Path<T>>(obj: T, path: P, value: Update<Value<T, P>>, rootPath = path): T {
  const _path = castArrayPath(path as any);
  const [first, ...rest] = _path;

  if (first === undefined) {
    return value as any;
  }

  const updateChild = (child: any) => {
    if (!child && rest.length > 0) {
      const _rootPath = castArrayPath(rootPath as any);

      const prefix = _rootPath.slice(0, -rest.length) as KeyType[];
      throw Error(`Cannot set ${rootPath} because ${prefix.join('.')} is ${child}`);
    }

    return set(child, rest as any, value, rootPath);
  };

  if (obj instanceof Map) {
    const copy = flatClone(obj);
    const child = copy.get(first);
    copy.set(first, updateChild(child));
    return copy;
  }

  if (obj instanceof Set) {
    const copy = [...obj];
    const child = copy[Number(first)];
    copy[Number(first)] = updateChild(child);
    return new Set(copy) as any;
  }

  if (obj instanceof Object) {
    const copy = flatClone(obj);
    copy[first as keyof T] = updateChild(copy[first as keyof T]);
    return copy;
  }

  throw new Error(`Could not set ${path} of ${obj}`);
}

export function remove<T, P extends Path<T, true>>(obj: T, path: P): T {
  const _path = castArrayPath(path as any);

  if (_path.length === 0) {
    return undefined as any;
  }

  const parentPath = _path.slice(0, -1);
  const key = _path[_path.length - 1];

  const parent = flatClone(get(obj, parentPath as any));

  if (parent instanceof Map) {
    parent.delete(key);
  } else if (parent instanceof Set) {
    const value = Array.from(parent)[Number(key)];
    parent.delete(value);
  } else {
    delete parent[key as keyof typeof parent];
  }

  return set(obj, parentPath as any, parent);
}
