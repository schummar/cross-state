import eq from 'fast-deep-equal';
import produce, { Draft, PatchListener } from 'immer';
import { useEffect, useState } from 'react';

export type Listener<T> = (value: T) => void;

export class Store<T> {
  listeners = new Set<Listener<T>>();

  constructor(private state: T) {}

  getRawState() {
    return this.state;
  }

  update(update: (draft: Draft<T>) => void, listener?: PatchListener) {
    this.state = produce(this.state, update, listener);
    this.notify();
  }

  subscribe(listener: Listener<T>) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export function useStoreState<T>(store: Store<T>): T;
export function useStoreState<T, S>(store: Store<T>, selector: (state: T) => S, dependencies?: any[]): S;
export function useStoreState<T, S>(store: Store<T>, selector: (state: T) => S = (x) => x as any, dependencies: any[] = []) {
  const [state, setState] = useState(selector(store.getRawState()));

  function update() {
    const newState = selector(store.getRawState());
    setState((state) => (eq(state, newState) ? state : newState));
  }

  useEffect(() => {
    update();
    return store.subscribe(update);
  }, [store, ...dependencies]);

  return state;
}
