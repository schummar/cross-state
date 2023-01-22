import type { Update } from '../core/commonTypes';
import { flatClone } from './clone';
import type { Path, Value } from './path';

export function castArrayPath<T>(path: Path<T>): Path<T> & KeyType[] {
  if (Array.isArray(path)) {
    return path as Path<T> & KeyType[];
  }

  if (path === '') {
    return [] as Path<T> & KeyType[];
  }

  return path.split('.') as Path<T> & KeyType[];
}

export function get<T, P extends Path<T>>(obj: T, path: P): Value<T, P> {
  const _path = castArrayPath(path);
  const [first, ...rest] = _path;

  if (first === undefined || !obj) {
    return obj as Value<T, P>;
  }

  if (obj instanceof Map) {
    return get(obj.get(first), rest as any);
  }

  if (obj instanceof Set) {
    return get(Array.from(obj)[first as number], rest as any);
  }

  if (obj instanceof Object) {
    return get(obj[first as keyof T], rest as any) as Value<T, P>;
  }

  throw new Error(`Could not get ${path} of ${obj}`);
}

export function set<T, P extends Path<T>>(obj: T, path: P, value: Update<Value<T, P>>, rootPath = path): T {
  const _path = castArrayPath(path);
  const [first, ...rest] = _path;

  if (first === undefined) {
    return value as any;
  }

  const updateChild = (child: any) => {
    if (!child && rest.length > 0) {
      const _rootPath = castArrayPath(rootPath);

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
    const copy = flatClone(obj);
    const child = Array.from(copy)[first as number];
    copy.delete(child);
    copy.add(updateChild(child));
    return copy;
  }

  if (obj instanceof Object) {
    const copy = flatClone(obj);
    copy[first as keyof T] = updateChild(copy[first as keyof T]);
    return copy;
  }

  throw new Error(`Could not set ${path} of ${obj}`);
}
