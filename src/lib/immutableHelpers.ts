import type { Update, UpdateFrom } from '../core/types';
import type { Path, Value } from './propAccess';
import { set } from './propAccess';

type FnUpdate<T> = (value: T) => T;
type Fn = (...args: any) => any;

const arrMod =
  <P extends keyof Array<any>>(prop: P) =>
  <V>(...args: Array<V>[P] extends Fn ? Parameters<Array<V>[P]> : never): UpdateFrom<Array<V>, readonly V[]> =>
  (arr) => {
    const newArr = arr.slice();
    (newArr[prop] as Fn)(...(args as any));
    return newArr;
  };

export const i = {
  splice: arrMod('splice'),
  push: arrMod('push'),
  pop: arrMod('pop'),
  shift: arrMod('shift'),
  unshift: arrMod('unshift'),
  reverse: arrMod('reverse'),
  sort: arrMod('sort'),

  remove<T>(predicate: (value: T) => boolean): FnUpdate<Array<T>> {
    return (arr) => arr.filter((x) => !predicate(x));
  },

  update<T>(
    predicate: (value: T) => boolean,
    ...[value, upsert]: [value: Update<T>] | [value: UpdateFrom<T, T | undefined>, upsert: true]
  ): FnUpdate<Array<T>> {
    return (arr) => {
      let found = false;
      const newArr = arr.map((x) => {
        if (predicate(x)) {
          found = true;
          return value instanceof Function ? value(x) : value;
        }
        return x;
      });

      if (!found && upsert) {
        newArr.push(value instanceof Function ? value(undefined!) : value);
      }

      return newArr;
    };
  },

  add<T extends Set<any>>(value: T extends Set<infer V> ? V : never): FnUpdate<T> {
    return (set): any => {
      const newSet = new Set(set);
      newSet.add(value);
      return newSet;
    };
  },

  set<T extends Record<any, any> | Map<any, any>, K extends T extends Map<infer K, any> ? K : Path<T>>(
    key: K,
    value: Update<T extends Map<any, infer V> ? V : Value<T, K & string>>
  ): FnUpdate<T> {
    return (x): any => {
      if (x instanceof Map) {
        const newMap = new Map(x);
        newMap.set(key, value);
        return newMap;
      }

      return set(x, key as any, value as any);
    };
  },

  delete<T extends Record<any, any> | Map<any, any> | Set<any>>(
    key: T extends Map<infer K, any> ? K : T extends Set<infer K> ? K : keyof { [K in keyof T as undefined extends T[K] ? K : never]: 1 }
  ): FnUpdate<T> {
    return (x): any => {
      if (x instanceof Map) {
        const newMap = new Map(x);
        newMap.delete(key);
        return newMap;
      }

      if (x instanceof Set) {
        const newSet = new Set(x);
        newSet.delete(key);
        return newSet;
      }

      const newObj: Record<any, any> = { ...x };
      delete newObj[key];
      return newObj;
    };
  },
};
