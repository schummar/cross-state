import type { Update, UpdateFrom } from '../core/types';
import type { Path, Value } from './propAccess';
import { set } from './propAccess';

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

  add<T extends Set<any>>(value: T extends Set<infer V> ? V : never): Update<T> {
    return (set): any => {
      const newSet = new Set(set);
      newSet.add(value);
      return newSet;
    };
  },

  set<T extends Record<any, any> | Map<any, any>, K extends T extends Map<infer K, any> ? K : Path<T>>(
    key: K,
    value: T extends Map<any, infer V> ? V : Value<T, K & string>
  ): Update<T> {
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
  ): Update<T> {
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

// const store = atomicStore({
//   obj: { foo: 'bar', baz: 1 as 1 | undefined },
//   arr: [{ foo: 'bar' }],
//   rarr: [1, 2, 3] as readonly number[],
//   set: new Set([{ foo: 'bar' }]),
//   map: new Map([[1, { foo: 'bar' }]]),
// });

// store.set('arr', i.splice(1, 10));
// store.set('arr', i.push({ foo: '' }));
// store.set('arr', i.pop());
// store.set('arr', i.shift());
// store.set('arr', i.unshift({ foo: '' }));
// store.set('arr', i.reverse());
// store.set('arr', i.sort());
// store.set('rarr', i.sort());

// store.set('set', i.add({ foo: '' }));

// store.set('obj', i.set('foo', 'baz'));
// store.set('map', i.set(1, { foo: 'baz' }));

// store.set('obj', i.delete('baz'));
// store.set('set', i.delete({ foo: '' }));
// store.set('map', i.delete(1));
