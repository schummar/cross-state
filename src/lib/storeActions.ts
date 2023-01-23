import type { Update, UpdateFrom } from '@core/commonTypes';
import type { Store } from '../core/store';
import type { Path, Value } from './path';
import { get, set } from './propAccess';
import type { OptionalPropertyOf } from './typeHelpers';

type Fn = (...args: any) => any;

const arrMod = <P extends keyof Array<any>>(prop: P) =>
  function <T extends Array<any>>(
    this: Store<T>,
    ...args: T[P] extends Fn ? Parameters<T[P]> : never
  ): T[P] extends Fn ? ReturnType<T[P]> : never {
    const newArr = this.get().slice() as T;
    const result = (newArr[prop] as Fn)(...(args as any));
    this.update(newArr);
    return result;
  };

export const arrayActions = {
  splice: arrMod('splice'),
  push: arrMod('push'),
  pop: arrMod('pop'),
  shift: arrMod('shift'),
  unshift: arrMod('unshift'),
  reverse: arrMod('reverse'),
  sort: arrMod('sort'),
};

export const recordActions = {
  set<T extends Record<any, any>, P extends Path<T>>(this: Store<T>, path: P, value: Update<Value<T, P>>) {
    if (value instanceof Function) {
      value = value(get(this.get(), path));
    }

    this.update(set(this.get(), path, value));
    return this;
  },

  delete<T extends Record<any, any>, K extends OptionalPropertyOf<T>>(this: Store<T>, key: K) {
    const copy = { ...this.get() };
    delete copy[key];
    this.update(copy);
  },

  clear<T extends Record<any, any>>(this: Store<Partial<T>>) {
    this.update({} as T);
  },
};

export const mapActions = {
  set<K, V>(this: Store<Map<K, V>>, key: K, value: UpdateFrom<V, [V | undefined]>) {
    if (value instanceof Function) {
      value = value(this.get().get(key));
    }

    const newMap = new Map(this.get());
    newMap.set(key, value);
    this.update(newMap);
    return this;
  },

  delete<K, V>(this: Store<Map<K, V>>, key: K) {
    const newMap = new Map(this.get());
    const result = newMap.delete(key);
    this.update(newMap);
    return result;
  },

  clear<K, V>(this: Store<Map<K, V>>) {
    this.update(new Map());
  },
};

export const setActions = {
  add<T>(this: Store<Set<T>>, value: T) {
    const newSet = new Set(this.get());
    newSet.add(value);
    this.update(newSet);
  },

  delete<T>(this: Store<Set<T>>, value: T) {
    const newSet = new Set(this.get());
    newSet.delete(value);
    this.update(newSet);
  },

  clear<T>(this: Store<Set<T>>) {
    this.update(new Set());
  },
};
