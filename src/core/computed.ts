import { trackingProxy } from '../lib/trackingProxy';
import { atomicStore } from './atomicStore';
import type { Cancel, Duration, Effect, Listener, Store, SubscribeOptions } from './types';

export type Computed<Value> = ComputedImpl<Value>;

export interface ComputedUse {
  <T>(store: Store<T>): T;
  <T, S>(store: Store<T>, selector: (value: T) => S): S;
}

export interface ComputedOptions {
  disableProxy?: boolean;
}

const Empty = Symbol('empty');

class ComputedImpl<Value> implements Store<Value> {
  private isComputing = false;
  private depChecks = new Array<() => boolean>();
  private depHandles = new Array<Cancel>();
  private internalStore = atomicStore<Value | typeof Empty>(Empty);

  constructor(private readonly fn: (use: ComputedUse) => Value, private readonly options: ComputedOptions = {}) {
    this.addEffect(() => {
      // On becoming active, refresh cache. It will be kept up-to-date while active.
      this.compute(true);

      // On becoming inactive, stop updating
      return () => {
        for (const handle of this.depHandles) {
          handle();
        }
      };
    });
  }

  get() {
    return this.compute();
  }

  subscribe(listener: Listener<Value>, options?: SubscribeOptions): Cancel;
  subscribe<S>(listener: Listener<S>, selector: (value: Value) => S, options?: SubscribeOptions): Cancel;
  subscribe<S>(
    listener: Listener<S>,
    ...[arg1, arg2]: [options?: SubscribeOptions] | [selector: (value: Value) => S, options?: SubscribeOptions]
  ) {
    const selector: (value: Value) => S = arg1 instanceof Function ? arg1 : (value) => value as any;
    const options = arg1 instanceof Function ? arg2 : arg1;

    return this.internalStore.subscribe<S | undefined>(
      (value, previous) => listener(value!, previous),
      (value) => (value === Empty ? undefined : selector(value)),
      options
    );
  }

  addEffect(effect: Effect, retain?: Duration | undefined) {
    return this.internalStore.addEffect(effect, retain);
  }

  isActive() {
    return this.internalStore.isActive();
  }

  recreate(): this {
    return new ComputedImpl(this.fn, this.options) as this;
  }

  private compute(watch?: boolean) {
    if (this.isComputing) {
      throw Error('[schummar-state:compute] circular reference in computation!');
    }

    let value = this.internalStore.get();

    if (value !== Empty && this.depChecks.every((check) => check())) {
      return value;
    }

    for (const handle of this.depHandles) {
      handle();
    }

    this.isComputing = true;
    this.depChecks = [];
    this.depHandles = [];

    const deps = new Set<Store<any>>();

    value = this.fn(<T, S>(store: Store<T>, selector: (value: T) => S = (value) => value as any) => {
      let value = selector(store.get());
      let equals = (newValue: S) => newValue === value;

      if (!this.options.disableProxy) {
        [value, equals] = trackingProxy(value);
      }

      deps.add(store);
      this.depChecks.push(() => {
        return equals(selector(store.get()));
      });

      return value;
    });

    if (watch) {
      this.depHandles = [...deps].map((store) => store.subscribe(() => this.compute(true), { runNow: false }));
    }

    this.isComputing = false;
    this.internalStore.set(value);
    return value;
  }
}

export function computed<Value>(fn: (use: ComputedUse) => Value, options?: ComputedOptions): Store<Value> {
  return new ComputedImpl(fn, options);
}
