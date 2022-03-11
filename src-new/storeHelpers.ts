import { AtomicStore } from './atomicStore';

export const mapActions = {
  mset<K, V>(this: AtomicStore<Map<K, V>>, key: K, value: V) {
    const newMap = new Map(this.get());
    newMap.set(key, value);
    this.set(newMap);
    return this;
  },

  delete<K, V>(this: AtomicStore<Map<K, V>>, key: K) {
    const newMap = new Map(this.get());
    const result = newMap.delete(key);
    this.set(newMap);
    return result;
  },

  clear<K, V>(this: AtomicStore<Map<K, V>>) {
    this.set(new Map());
  },
};

export const setActions = {
  add<T>(this: AtomicStore<Set<T>>, value: T) {
    const newSet = new Set(this.get());
    newSet.add(value);
    this.set(newSet);
  },

  delete<T>(this: AtomicStore<Set<T>>, value: T) {
    const newSet = new Set(this.get());
    newSet.delete(value);
    this.set(newSet);
  },

  clear<T>(this: AtomicStore<Set<T>>) {
    this.set(new Set());
  },
};

export const arrayActions = {
  splice<T>(this: AtomicStore<Array<T>>, ...args: Parameters<Array<T>['splice']>) {
    const newArray = this.get().slice();
    const result = newArray.splice(...args);
    this.set(newArray);
    return result;
  },

  push<T>(this: AtomicStore<Array<T>>, ...args: Parameters<Array<T>['push']>) {
    const newArray = this.get().slice();
    const result = newArray.push(...args);
    this.set(newArray);
    return result;
  },

  pop<T>(this: AtomicStore<Array<T>>) {
    const newArray = this.get().slice();
    const result = newArray.pop();
    this.set(newArray);
    return result;
  },

  shift<T>(this: AtomicStore<Array<T>>, ...args: Parameters<Array<T>['shift']>) {
    const newArray = this.get().slice();
    const result = newArray.shift(...args);
    this.set(newArray);
    return result;
  },

  unshift<T>(this: AtomicStore<Array<T>>, ...args: Parameters<Array<T>['unshift']>) {
    const newArray = this.get().slice();
    const result = newArray.unshift(...args);
    this.set(newArray);
    return result;
  },
};
