import { autobind } from '@lib/autobind';
import { calcDuration } from '@lib/duration';
import { calculatedValue, staticValue, type CalculatedValue } from '@lib/calculatedValue';
import type { Constrain } from '@lib/constrain';
import { debounce } from '@lib/debounce';
import disposable from '@lib/disposable';
import { deepEqual } from '@lib/equals';
import { forwardError } from '@lib/forwardError';
import { isObject } from '@lib/helpers';
import { makeSelector } from '@lib/makeSelector';
import type { AnyPath, Path, SettablePath, Value } from '@lib/path';
import { PromiseWithCancel } from '@lib/promiseWithCancel';
import { get, set } from '@lib/propAccess';
import { arrayMethods, mapMethods, recordMethods, setMethods } from '@lib/standardMethods';
import { throttle } from '@lib/throttle';
import type {
  CalculationActions,
  Cancel,
  DisposableCancel,
  Duration,
  Effect,
  Listener,
  Selector,
  SubscribeOptions,
  Update,
} from './commonTypes';

export type StoreMethods = Record<string, (...args: any[]) => any>;

export type BoundStoreMethods<T, Methods extends StoreMethods> = Methods &
  ThisType<Store<T> & Methods>;

export interface StoreOptions<T> {
  retain?: Duration;
  equals?: SubscribeOptions['equals'];
  effect?: Effect<Store<T>> | { effect: Effect<Store<T>>; retain?: Duration };
  cacheValue?: boolean;
}

export interface StoreOptionsWithMethods<T, Methods extends StoreMethods> extends StoreOptions<T> {
  methods?: Methods & ThisType<Store<T> & Methods & StandardMethods<T>>;
}

export type Calculate<T> = (helpers: CalculationActions<T>) => T;

type StandardMethods<T> =
  T extends Map<any, any>
    ? typeof mapMethods
    : T extends Set<any>
      ? typeof setMethods
      : T extends Array<any>
        ? typeof arrayMethods
        : T extends Record<any, any>
          ? typeof recordMethods
          : Record<string, never>;

type StoreWithMethods<T, Methods extends StoreMethods> = Store<T> &
  Omit<BoundStoreMethods<T, Methods>, keyof Store<T>> &
  StandardMethods<T>;

export interface OnceOptions {
  signal?: AbortSignal;
  timeout?: Duration;
}

function noop() {
  return undefined;
}

export class Store<T> {
  private static hooks?: Set<(this: Store<any>, store: Store<any>) => void>;

  static addHook(hook: (store: Store<any>) => void): DisposableCancel {
    this.hooks ??= new Set();
    this.hooks.add(hook);
    return disposable(() => this.hooks?.delete(hook));
  }

  version?: string;

  protected calculatedValue?: CalculatedValue<T>;
  protected defaultValue?: CalculatedValue<T>;

  protected listeners: Map<Listener, boolean> = new Map();

  protected effects: Map<
    Effect<Store<T>>,
    { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }
  > = new Map();

  protected notifyId = {};

  constructor(
    public readonly getter: T | Calculate<T>,
    public readonly options: StoreOptions<T> = {},
    public readonly derivedFrom?: {
      store: Store<any>;
      selectors: (Selector<any, any> | AnyPath)[];
      updater: (state: any) => void;
    },
  ) {
    autobind(Store);

    if (typeof getter !== 'function') {
      this.calculatedValue = this.defaultValue = staticValue(getter);
    }

    for (const hook of Store.hooks ?? []) {
      hook.apply(this, [this]);
    }

    if (options.effect instanceof Function) {
      this.addEffect(options.effect);
    } else if (options.effect) {
      this.addEffect(options.effect.effect, options.effect.retain);
    }
  }

  get(): T {
    if (!this.calculatedValue?.check()) {
      this.calculatedValue?.stop();
      this.calculatedValue = undefined;
    }

    if (!this.calculatedValue) {
      this.calculatedValue = calculatedValue(this, this.notify);
    }

    return this.calculatedValue.value;
  }

  set(update: Update<T>): void;

  set<const P>(path: Constrain<P, Path<T>>, update: Update<Value<T, P>>): void;

  set(...args: any[]): void {
    const path: any = args.length > 1 ? args[0] : [];
    let update: Update<any> = args.length > 1 ? args[1] : args[0];

    if (update instanceof Function) {
      const before = this.get();
      const valueBefore = get(before, path);
      const valueAfter = update(valueBefore);
      update = set(before, path, valueAfter);
    } else if (path.length > 0) {
      update = set(this.get(), path, update);
    }

    if (this.derivedFrom) {
      this.derivedFrom.updater(update);
      return;
    }

    this.calculatedValue?.stop();
    this.calculatedValue = staticValue(update);
    this.notify();
  }

  invalidate(recursive?: boolean): void {
    if (recursive) {
      this.calculatedValue?.invalidateDependencies(recursive);
    }

    this.calculatedValue?.stop();
    this.calculatedValue = this.defaultValue;
    this.notify();
  }

  subscribe(
    listener: Listener<T, { cancel: Cancel }>,
    options?: SubscribeOptions,
  ): DisposableCancel {
    const {
      passive,
      runNow = true,
      throttle: throttleOption,
      debounce: debounceOption,
      equals = this.options.equals ?? deepEqual,
    } = options ?? {};

    let isSetup = false;
    let previousValue: { value: T } | undefined;

    let innerListener = () => {
      if (!isSetup) {
        return;
      }

      const value = passive ? this.calculatedValue : { value: this.get() };

      if (!value) {
        return;
      }

      if (previousValue && equals(value.value, previousValue.value)) {
        return;
      }

      const _previousValue = previousValue?.value;
      previousValue = this.calculatedValue && { value: this.calculatedValue?.value };

      try {
        listener.apply({ cancel }, [value.value, _previousValue]);
      } catch (error) {
        forwardError(error);
      }
    };

    if (throttleOption) {
      innerListener = throttle(innerListener, throttleOption);
    } else if (debounceOption) {
      innerListener = debounce(innerListener, debounceOption);
    }

    this.listeners.set(innerListener, !passive);
    const cancel = () => {
      if (this.listeners.delete(innerListener) && !passive) {
        this.onUnsubscribe();
      }
    };

    if (!passive) {
      this.onSubscribe();
    }

    isSetup = true;

    if (runNow) {
      innerListener();

      if (
        !throttleOption &&
        typeof debounceOption === 'object' &&
        'waitOnRunNow' in debounceOption &&
        debounceOption.waitOnRunNow === false &&
        'flush' in innerListener
      ) {
        (innerListener as { flush: () => void }).flush();
      }
    } else {
      previousValue = passive
        ? this.calculatedValue && { value: this.calculatedValue.value }
        : { value: this.get() };
    }

    return disposable(cancel);
  }

  once<S extends T>(
    condition: (value: T) => value is S,
    options?: OnceOptions,
  ): PromiseWithCancel<S>;

  once(condition: (value: T) => boolean, options?: OnceOptions): PromiseWithCancel<T>;

  once(options?: OnceOptions): PromiseWithCancel<Exclude<T, undefined>>;

  once(
    ...args: [condition: (value: any) => boolean, options?: OnceOptions] | [options?: OnceOptions]
  ): PromiseWithCancel<any> {
    const condition = args[0] instanceof Function ? args[0] : (x: T) => x !== undefined;
    const options = args[0] instanceof Function ? args[1] : args[0];

    return new PromiseWithCancel<T>((resolve, reject, signal) => {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const cancel = this.subscribe(
        (value) => {
          if (stopped || !condition(value)) {
            return;
          }

          resolve(value);
          stopped = true;
          if (timer) {
            clearTimeout(timer);
          }
          setTimeout(() => cancel());
        },
        {
          runNow: !!condition,
        },
      );

      if (stopped) {
        return;
      }

      signal.addEventListener('abort', cancel);

      options?.signal?.addEventListener('abort', () => {
        cancel();
        reject(options.signal?.reason ?? new Error('cancelled'));
      });

      if (options?.timeout !== undefined) {
        timer = setTimeout(() => {
          cancel();
          reject(new Error('timeout'));
        }, calcDuration(options.timeout));
      }
    });
  }

  map<S>(selector: Selector<T, S>, updater?: (value: S) => Update<T>): Store<S>;

  map<const P>(selector: Constrain<P, SettablePath<T>>): Store<Value<T, P>>;

  map(_selector: Selector<T, any> | SettablePath<any>, ...args: any[]): Store<any> {
    const updater: ((value: any) => Update<T>) | undefined =
      _selector instanceof Function
        ? args[0]
        : (value) => (state) => set(state, _selector as any, value);

    const selector = makeSelector(_selector);

    const derivedFrom = {
      store: this.derivedFrom ? this.derivedFrom.store : this,
      selectors: this.derivedFrom ? [...this.derivedFrom.selectors, _selector] : [_selector],

      updater: (value: any) => {
        if (!updater) {
          throw new TypeError(
            'Can only update computed stores that either are derived from other stores using string selectors or have an updater function.',
          );
        }

        let update = updater(value);

        if (update instanceof Function) {
          update = update(this.get());
        }

        if (this.derivedFrom) {
          this.derivedFrom.updater(update);
        } else {
          this.set(update);
        }
      },
    };

    return new Store(
      ({ use }) => {
        return selector(use(this));
      },
      undefined,
      derivedFrom,
    );
  }

  /** Add an effect that will be executed when the store becomes active, which means when it has at least one subscriber.
   * @param effect
   * If there is already a subscriber, the effect will be executed immediately.
   * Otherweise it will be executed as soon as the first subscription is created.
   * Every time all subscriptions are removed and the first is created again, the effect will be executed again.
   * @param retain
   * If provided, delay tearing down effects when the last subscriber is removed. This is useful if a short gap in subscriber coverage is supposed to be ignored. E.g. when switching pages, the old page might unsubscribe, while the new page subscribes immediately after.
   * @returns
   * The effect can return a teardown callback, which will be executed when the last subscription is removed and potentially the ratain time has passed.
   */
  addEffect(
    effect: Effect<Store<T>>,
    retain: Duration | undefined = this.options.retain,
  ): DisposableCancel {
    this.effects.set(effect, {
      handle: this.isActive() ? (effect.apply(this, [this]) ?? noop) : undefined,
      retain: retain !== undefined ? calcDuration(retain) : undefined,
    });

    return disposable(() => {
      const { handle, timeout } = this.effects.get(effect) ?? {};
      handle?.();

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      this.effects.delete(effect);
    });
  }

  /** Return whether the store is currently active, which means whether it has at least one subscriber. */
  isActive(): boolean {
    return [...this.listeners.values()].some(Boolean);
  }

  protected onSubscribe(): void {
    if ([...this.listeners.values()].filter(Boolean).length > 1) return;

    for (const [effect, { handle, retain, timeout }] of this.effects.entries()) {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      this.effects.set(effect, {
        handle: handle ?? effect.apply(this, [this]) ?? noop,
        retain,
        timeout: undefined,
      });
    }
  }

  protected onUnsubscribe(): void {
    if ([...this.listeners.values()].some(Boolean)) return;

    for (const [effect, { handle, retain, timeout }] of this.effects.entries()) {
      if (!retain) {
        handle?.();

        if (timeout !== undefined) {
          clearTimeout(timeout);
        }

        this.effects.set(effect, {
          handle: undefined,
          retain,
          timeout: undefined,
        });

        continue;
      }

      const newTimeout =
        timeout ??
        (handle
          ? setTimeout(() => {
              handle();
              this.effects.set(effect, {
                handle: undefined,
                retain,
                timeout: undefined,
              });
            }, retain)
          : undefined);

      this.effects.set(effect, {
        handle,
        retain,
        timeout: newTimeout,
      });
    }
  }

  protected notify(): void {
    const n = {};
    this.notifyId = n;

    const snapshot = [...this.listeners.entries()];
    const active = snapshot.filter(([, active]) => active);
    const passive = snapshot.filter(([, active]) => !active);
    for (const [listener] of [...active, ...passive]) {
      listener();
      if (n !== this.notifyId) break;
    }
  }
}

function create<T>(calculate: Calculate<T>, options?: StoreOptions<T>): Store<T>;
function create<T, Methods extends StoreMethods = {}>(
  initialState: T,
  options?: StoreOptionsWithMethods<T, Methods>,
): StoreWithMethods<T, Methods>;
function create<T, Methods extends StoreMethods>(
  initialState: T | Calculate<T>,
  options?: StoreOptionsWithMethods<T, Methods>,
): StoreWithMethods<T, Methods> | Store<T> {
  options = { ...createStore.defaultOptions, ...options };

  const store = new Store(initialState, options);

  if (initialState instanceof Function) {
    return store;
  }

  let methods: StoreMethods | undefined = options?.methods;

  if (initialState instanceof Map) {
    methods = { ...mapMethods, ...methods };
  } else if (initialState instanceof Set) {
    methods = { ...setMethods, ...methods };
  } else if (Array.isArray(initialState)) {
    methods = { ...arrayMethods, ...methods };
  } else if (isObject(initialState)) {
    methods = { ...recordMethods, ...methods };
  }

  const boundMethods = Object.fromEntries(
    Object.entries(methods ?? ({} as BoundStoreMethods<T, any>))
      .filter(([name]) => !(name in store))
      .map(([name, action]) => [name, (action as any).bind(store)]),
  ) as BoundStoreMethods<T, any>;

  return Object.assign(store, boundMethods);
}

export const createStore: typeof create & { defaultOptions: StoreOptions<any> } =
  /* @__PURE__ */ Object.assign(create, {
    defaultOptions: {
      equals: deepEqual,
    } as StoreOptions<any>,
  });
