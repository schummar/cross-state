import { enableMapSet } from 'immer';
import hash from 'object-hash';
import { useEffect } from 'react';
import { Store, useStoreState } from './state';

enableMapSet();

export class Cache<T extends Record<string, any>, Id> extends Store<Map<Id, T>> {
  id: (t: T) => Id;

  constructor(id: (Id extends keyof T ? Id : never) | ((t: T) => Id)) {
    super(new Map());
    this.id = id instanceof Function ? id : (t) => t[id];
  }

  createAction<A extends (...args: any[]) => T | T[] | Promise<T> | Promise<T[]>>(action: A): Action<T, Id, A> {
    return new Action(this, action);
  }
}

export class Action<T extends Record<string, any>, Id, A extends (...args: any[]) => T | T[] | Promise<T> | Promise<T[]>> {
  ids = new Store<Map<string, Id | Id[]>>(new Map());
  isLoading = new Set<string>();

  constructor(public cache: Cache<T, Id>, private action: A) {}

  use(...args: Parameters<A>) {
    const key = hash(args);
    const ids = useStoreState(this.ids, (ids) => ids.get(key), [key]);
    const items = useStoreState(
      this.cache,
      (items) => {
        if (ids instanceof Array) return ids.map((id) => items.get(id)!);
        if (ids) return items.get(ids)!;
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
          state.set(id as any, item as any);
        });
        const ids = result instanceof Array ? result.map((item) => this.cache.id(item)) : this.cache.id(result);
        this.ids.update((state) => {
          state.set(key, ids as any);
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading.delete(key);
    }
  }
}
