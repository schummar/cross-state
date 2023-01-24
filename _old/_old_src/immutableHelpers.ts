import type { Update, UpdateFrom } from '../src/core/commonTypes';
import type { Path, Value } from '../src/lib/propAccess';
import { set } from '../src/lib/propAccess';

type FunctionUpdate<T> = (value: T) => T;
type Function_ = (...args: any) => any;

const arrayModule =
  <P extends keyof Array<any>>(prop: P) =>
  <V>(
    ...args: Array<V>[P] extends Function_ ? Parameters<Array<V>[P]> : never
  ): UpdateFrom<Array<V>, readonly V[]> =>
  (array) => {
    const newArray = array.slice();
    (newArray[prop] as Function_)(...(args as any));
    return newArray;
  };

export const i = {
  splice: arrayModule('splice'),
  push: arrayModule('push'),
  pop: arrayModule('pop'),
  shift: arrayModule('shift'),
  unshift: arrayModule('unshift'),
  reverse: arrayModule('reverse'),
  sort: arrayModule('sort'),

  remove<T>(predicate: (value: T) => boolean): FunctionUpdate<Array<T>> {
    return (array) => array.filter((x) => !predicate(x));
  },

  update<T>(
    predicate: (value: T) => boolean,
    ...[value, upsert]: [value: Update<T>] | [value: UpdateFrom<T, T | undefined>, upsert: true]
  ): FunctionUpdate<Array<T>> {
    return (array) => {
      let found = false;
      const newArray = array.map((x) => {
        if (predicate(x)) {
          found = true;
          return value instanceof Function ? value(x) : value;
        }
        return x;
      });

      if (!found && upsert) {
        newArray.push(value instanceof Function ? value(undefined!) : value);
      }

      return newArray;
    };
  },

  add<T extends Set<any>>(value: T extends Set<infer V> ? V : never): FunctionUpdate<T> {
    return (set): any => {
      const newSet = new Set(set);
      newSet.add(value);
      return newSet;
    };
  },

  set<
    T extends Record<any, any> | Map<any, any>,
    K extends T extends Map<infer K, any> ? K : Path<T>,
  >(
    key: K,
    value: Update<T extends Map<any, infer V> ? V : Value<T, K & string>>,
  ): FunctionUpdate<T> {
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
    key: T extends Map<infer K, any>
      ? K
      : T extends Set<infer K>
      ? K
      : keyof { [K in keyof T as undefined extends T[K] ? K : never]: 1 },
  ): FunctionUpdate<T> {
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

      const newObject: Record<any, any> = { ...x };
      delete newObject[key];
      return newObject;
    };
  },
};
