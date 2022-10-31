import { bind } from '../lib/bind';
import type { Cancel, Effect, Listener, Selector, SubscribeOptions } from './commonTypes';

export class Store<T> {
  protected value = this.initialValue;
  protected listeners = new Set<Listener<T>>();
  protected isActive = false;

  constructor(protected initialValue: T) {
    bind(this);
  }

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
  }

  sub(listener: Listener<T>, options?: SubscribeOptions): Cancel {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  map<S>(selector: Selector<T, S>): Store<S> {
    return {} as any;
  }

  addEffect(effect: Effect): Cancel {
    return () => {};
  }
}
