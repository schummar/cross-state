import type { Store } from '../core/store';
import type { OptionalPropertyOf } from './typeHelpers';

type Function_ = (...args: any) => any;

const createArrayAction = <P extends keyof Array<any>>(prop: P) =>
  function arrayAction<T extends Array<any>>(
    this: Store<T>,
    ...args: T[P] extends Function_ ? Parameters<T[P]> : never
  ): T[P] extends Function_ ? ReturnType<T[P]> : never {
    const newArray = this.get().slice() as T;
    const result = (newArray[prop] as Function_)(...(args as any));
    this.set(newArray);
    return result;
  };

export const arrayMethods = {
  splice: createArrayAction('splice'),
  push: createArrayAction('push'),
  pop: createArrayAction('pop'),
  shift: createArrayAction('shift'),
  unshift: createArrayAction('unshift'),
  reverse: createArrayAction('reverse'),
  sort: createArrayAction('sort'),
};

export const recordMethods = {
  // set<T extends Record<any, any>, P extends Path<T>>(
  //   this: Store<T>,
  //   path: P,
  //   value: Update<Value<T, P>>,
  // ) {
  //   if (value instanceof Function) {
  //     value = value(get(this.get(), path));
  //   }

  //   this.set(set(this.get(), path, value));
  //   return this;
  // },

  delete<T extends Record<any, any>, K extends OptionalPropertyOf<T>>(this: Store<T>, key: K) {
    const copy = { ...this.get() };
    delete copy[key];
    this.set(copy);
  },

  clear<T extends Record<any, any>>(this: Store<Partial<T>>) {
    this.set({} as T);
  },
};

export const mapMethods = {
  // set<K, V>(this: Store<Map<K, V>>, key: K, value: UpdateFrom<V, [V | undefined]>) {
  //   if (value instanceof Function) {
  //     value = value(this.get().get(key));
  //   }

  //   const newMap = new Map(this.get());
  //   newMap.set(key, value);
  //   this.set(newMap);
  //   return this;
  // },

  delete<K, V>(this: Store<Map<K, V>>, key: K) {
    const newMap = new Map(this.get());
    const result = newMap.delete(key);
    this.set(newMap);
    return result;
  },

  clear<K, V>(this: Store<Map<K, V>>) {
    this.set(new Map());
  },
};

export const setMethods = {
  add<T>(this: Store<Set<T>>, value: T) {
    const newSet = new Set(this.get());
    newSet.add(value);
    this.set(newSet);
  },

  delete<T>(this: Store<Set<T>>, value: T) {
    const newSet = new Set(this.get());
    newSet.delete(value);
    this.set(newSet);
  },

  clear<T>(this: Store<Set<T>>) {
    this.set(new Set());
  },
};
