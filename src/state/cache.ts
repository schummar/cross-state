import { Draft, enableMapSet } from 'immer';
import hash from 'object-hash';
import { useEffect } from 'react';
import { Store, useStoreState } from './state';

enableMapSet();

type KeysOfStringProps<T> = keyof { [K in keyof T as T[K] extends string ? K : never]: T[K] };

export class Cache<T extends Record<string, any>> extends Store<{ [id: string]: T }> {
  id: (t: T) => string;

  constructor(id: KeysOfStringProps<T> | ((t: T) => string)) {
    super({});
    this.id = id instanceof Function ? id : (t) => t[id as keyof T];
  }

  createAction<A extends (...args: any[]) => T | T[] | Promise<T> | Promise<T[]>>(action: A): Action<T, A> {
    return new Action(this, action);
  }
}

export class Action<T extends Record<string, any>, A extends (...args: any[]) => T | T[] | Promise<T> | Promise<T[]>> {
  ids = new Store<{ [key: string]: string | string[] }>({});
  isLoading = new Set<string>();

  constructor(public cache: Cache<T>, private action: A) {}

  use(...args: Parameters<A>) {
    const key = hash(args);
    const ids = useStoreState(this.ids, (ids) => ids[key], [key]);
    const items = useStoreState(
      this.cache,
      (items) => {
        if (ids instanceof Array) {
          const mapped = ids.map((id) => items[id]);
          if (mapped.some((item) => item === undefined)) return undefined;
          return mapped as T[];
        }
        if (ids) return items[ids];
        return undefined;
      },
      [ids]
    );

    useEffect(() => {
      if (!items && !this.isLoading.has(key)) {
        this.load(key, args);
      }
    }, [key, items]);

    return items;
  }

  async load(key: string, args: Parameters<A>) {
    this.isLoading.add(key);
    try {
      const result = await this.action(...args);
      for (const item of result instanceof Array ? result : [result]) {
        this.cache.update((state) => {
          const id = this.cache.id(item);
          state[id] = item as Draft<T>;
        });
        const ids = result instanceof Array ? result.map((item) => this.cache.id(item)) : this.cache.id(result);
        this.ids.update((state) => {
          state[key] = ids;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading.delete(key);
    }
  }
}
