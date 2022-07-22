import { atomicStore } from '../core/atomicStore';
import type { Update } from '../core/types';
import type { Path, Value } from './propAccess';
import { set } from './propAccess';

type Fn = (...args: any) => any;
type ArrMethodKeys = keyof { [K in keyof Array<any> as Array<any>[K] extends Fn ? K : never]: 1 };

const arrMod =
  <P extends ArrMethodKeys>(prop: P) =>
  <V>(...args: Array<V>[P] extends (...args: any) => any ? Parameters<Array<V>[P]> : []): Update<Array<V>> =>
  (arr) => {
    const newArr = arr.slice();
    (newArr[prop] as Fn)(...(args as any));
    return newArr;
  };

type FnKey<T> = keyof { [K in keyof T as T[K] extends Fn ? K : never]: 1 } & keyof T;

class I {
  mod<T, K extends FnKey<T>>(fn: K, ...args: T[K] extends Fn ? Parameters<T[K]> : []): Update<T> {
    return (x) => {
      const y: any = x instanceof Map ? new Map(x) : x instanceof Set ? new Set(x) : Array.isArray(x) ? Array.from(x) : { ...x };
      y[fn](...(args as any));
      return y;
    };
  }

  splice = arrMod('splice');
  push = arrMod('push');
  pop = arrMod('pop');
  shift = arrMod('shift');
  unshift = arrMod('unshift');

  add<V>(value: V): Update<Set<V>> {
    return (set) => {
      const newSet = new Set(set);
      newSet.add(value);
      return newSet;
    };
  }

  set<T, K extends T extends Map<infer K, any> ? K : Path<T>, V extends T extends Map<any, infer V> ? V : Value<T, K & string>>(
    key: K,
    value: V
  ): Update<T> {
    return (x): any => {
      if (x instanceof Map) {
        const newMap = new Map(x);
        newMap.set(key, value);
        return newMap;
      }

      return set(x, key, value);
    };
  }

  delete<T, K extends T extends Map<infer K, any> ? K : T extends Set<infer K> ? K : keyof T>(key: K): Update<T> {
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
  }
}
export const i = new I();

const s = atomicStore({ foo: { bar: 'baz' }, bar: new Map([[1, true]]), arr: [1, 2, 3] });
s.set('foo', i.set('bar', 'buzz'));
s.set('bar', i.set(1, true));

s.set('foo', i.delete('bar'));
s.set('bar', i.delete(1));

s.set('arr', i.splice(1, 10));
s.set('arr', i.splice(1, 10));

s.set('arr', i.mod('splice', 1, 10));
s.set('bar', i.mod('set', 1, true));
s.set('arr', i.mod('splice', 1, 10));
