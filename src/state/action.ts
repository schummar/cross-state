import { Draft } from 'immer';
import { useEffect } from 'react';
import { KeysOfPropType } from './misc';
import { Store } from './store';

type ActionStore<T> = { [key: string]: T };

export class Action<S, T, A extends (...args: any[]) => T | T[] | Promise<T> | Promise<T[]>> {
  ids = new Store<{ [key: string]: string | string[] }>({});
  isLoading = new Set<string>();

  constructor(public store: Store<S>, private selector: (state: S) => ActionStore<T>, private id: (item: T) => string, private action: A) {}

  subscribe(...args: Parameters<A>) {
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
