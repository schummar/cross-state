import type { AtomicStore } from '../core/atomicStore';

type Fn = (...args: any) => any;

const arrMod = <P extends keyof Array<any>>(prop: P) =>
  function <V>(
    this: AtomicStore<Array<V>>,
    ...args: Array<V>[P] extends Fn ? Parameters<Array<V>[P]> : never
  ): Array<V>[P] extends Fn ? ReturnType<Array<V>[P]> : never {
    const newArr = this.get().slice();
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
  set<K extends string | number | symbol, V>(this: AtomicStore<Record<K, V>>, key: K, value: V) {
    this.update((x) => ({ ...x, [key]: value }));
    return this;
  },

  delete<K extends string | number | symbol, V>(this: AtomicStore<Record<K, V>>, key: K) {
    const copy = { ...this.get() };
    delete copy[key];
    this.update(copy);
  },

  clear<K extends string | number | symbol, V>(this: AtomicStore<Record<K, V>>) {
    this.update({} as Record<K, V>);
  },
};

export const mapActions = {
  set<K, V>(this: AtomicStore<Map<K, V>>, key: K, value: V) {
    const newMap = new Map(this.get());
    newMap.set(key, value);
    this.update(newMap);
    return this;
  },

  delete<K, V>(this: AtomicStore<Map<K, V>>, key: K) {
    const newMap = new Map(this.get());
    const result = newMap.delete(key);
    this.update(newMap);
    return result;
  },

  clear<K, V>(this: AtomicStore<Map<K, V>>) {
    this.update(new Map());
  },
};

export const setActions = {
  add<T>(this: AtomicStore<Set<T>>, value: T) {
    const newSet = new Set(this.get());
    newSet.add(value);
    this.update(newSet);
  },

  delete<T>(this: AtomicStore<Set<T>>, value: T) {
    const newSet = new Set(this.get());
    newSet.delete(value);
    this.update(newSet);
  },

  clear<T>(this: AtomicStore<Set<T>>) {
    this.update(new Set());
  },
};