import type { Store } from '../core/store';
import type { OptionalPropertyOf } from './typeHelpers';

type Function_ = (...args: any) => any;

function createArrayAction<P extends keyof Array<any>>(prop: P) {
  return function arrayAction<T extends Array<any>>(
    this: Store<T>,
    ...args: T[P] extends Function_ ? Parameters<T[P]> : never
  ): T[P] extends Function_ ? ReturnType<T[P]> : never {
    const newArray = this.get().slice() as T;
    const result = (newArray[prop] as Function_)(...(args as any));
    this.set(newArray);
    return result;
  };
}
export const arrayMethods: {
  [P in 'splice' | 'push' | 'pop' | 'shift' | 'unshift' | 'reverse' | 'sort']: <
    T extends Array<any>,
  >(
    this: Store<T>,
    ...args: T[P] extends Function_ ? Parameters<T[P]> : never
  ) => T[P] extends Function_ ? ReturnType<T[P]> : never;
} = {
  splice: /* @__PURE__ */ createArrayAction('splice'),
  push: /* @__PURE__ */ createArrayAction('push'),
  pop: /* @__PURE__ */ createArrayAction('pop'),
  shift: /* @__PURE__ */ createArrayAction('shift'),
  unshift: /* @__PURE__ */ createArrayAction('unshift'),
  reverse: /* @__PURE__ */ createArrayAction('reverse'),
  sort: /* @__PURE__ */ createArrayAction('sort'),
};

export const recordMethods = {
  delete<T extends Record<any, any>, K extends OptionalPropertyOf<T>>(
    this: Store<T>,
    key: K,
  ): void {
    const copy = { ...this.get() };
    delete copy[key];
    this.set(copy);
  },

  clear<T extends Record<any, any>>(this: Store<Partial<T>>): void {
    this.set({} as T);
  },
};

export const mapMethods = {
  delete<K, V>(this: Store<Map<K, V>>, key: K): boolean {
    const newMap = new Map(this.get());
    const result = newMap.delete(key);
    this.set(newMap);
    return result;
  },

  clear<K, V>(this: Store<Map<K, V>>): void {
    this.set(new Map());
  },
};

export const setMethods = {
  add<T>(this: Store<Set<T>>, value: T): void {
    const newSet = new Set(this.get());
    newSet.add(value);
    this.set(newSet);
  },

  delete<T>(this: Store<Set<T>>, value: T): void {
    const newSet = new Set(this.get());
    newSet.delete(value);
    this.set(newSet);
  },

  clear<T>(this: Store<Set<T>>): void {
    this.set(new Set());
  },
};
