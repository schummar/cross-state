import type { Store } from '../core/store';
import type { Path, Value } from './path';
import { get, set } from './propAccess';
import type { OptionalPropertyOf } from './typeHelpers';
import type { Update, UpdateFrom } from '@core/commonTypes';

type Function_ = (...args: any) => any;

const createArrayAction = <P extends keyof Array<any>>(prop: P) =>
  function arrayAction<T extends Array<any>>(
    this: Store<T>,
    ...args: T[P] extends Function_ ? Parameters<T[P]> : never
  ): T[P] extends Function_ ? ReturnType<T[P]> : never {
    const newArray = this.get().slice() as T;
    const result = (newArray[prop] as Function_)(...(args as any));
    this.update(newArray);
    return result;
  };

export const arrayActions = {
  splice: createArrayAction('splice'),
  push: createArrayAction('push'),
  pop: createArrayAction('pop'),
  shift: createArrayAction('shift'),
  unshift: createArrayAction('unshift'),
  reverse: createArrayAction('reverse'),
  sort: createArrayAction('sort'),
};

export const recordActions = {
  set<T extends Record<any, any>, P extends Path<T>>(
    this: Store<T>,
    path: P,
    value: Update<Value<T, P>>,
  ) {
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
