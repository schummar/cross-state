import type {
  Cancel,
  Duration,
  Effect,
  Listener,
  Selector,
  SubscribeOptions,
  Update,
  Use,
  UseOptions,
} from './commonTypes';
import { bind } from '@lib/bind';
import { calcDuration } from '@lib/calcDuration';
import { CalculationHelper } from '@lib/calculationHelper';
import { defaultEquals } from '@lib/equals';
import { forwardError } from '@lib/forwardError';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/path';
import { set } from '@lib/propAccess';
import { arrayActions, mapActions, recordActions, setActions } from '@lib/storeActions';
import { throttle } from '@lib/throttle';

export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<T, Actions extends StoreActions> = Actions &
  ThisType<Store<T> & Actions>;

export interface StoreOptions {
  retain?: number;
}

export interface StoreOptionsWithActions<T, Actions extends StoreActions> extends StoreOptions {
  methods?: Actions & ThisType<Store<T> & Actions & StandardActions<T>>;
}

export type Calculate<T> = (this: { use: Use }, fns: { use: Use }) => T;

type StandardActions<T> = T extends Map<any, any>
  ? typeof mapActions
  : T extends Set<any>
  ? typeof setActions
  : T extends Array<any>
  ? typeof arrayActions
  : T extends Record<any, any>
  ? typeof recordActions
  : Record<string, never>;

type StoreWithActions<T, Actions extends StoreActions> = Store<T> &
  Omit<BoundStoreActions<T, Actions>, keyof Store<T>> &
  StandardActions<T>;

const noop = () => undefined;

export class Store<T> {
  private _value?: { v: T };

  protected listeners = new Set<Listener>();

  protected effects = new Map<
    Effect,
    { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }
  >();

  protected notifyId = {};

  private calculationHelper = new CalculationHelper({
    calculate: ({ use }) => {
      if (this.getter instanceof Function) {
        const value = this.getter.apply({ use }, [{ use }]);
        this._value = { v: value };
        this.notify();
      }
    },

    addEffect: this.addEffect.bind(this),
    onInvalidate: this.invalidate.bind(this),
  });

  constructor(
    protected readonly getter: T | Calculate<T>,
    protected readonly options: StoreOptions = {},
    protected derivedFrom?: { store: Store<any>; selectors: (Selector<any, any> | Path<any>)[] },
  ) {
    bind(this);

    if (!(getter instanceof Function)) {
      this._value = { v: getter };
    }
  }

  get(): T {
    this.calculationHelper.check();

    if (!this._value) {
      this.calculationHelper.execute();
      return this.get();
    }

    return this._value.v;
  }

  update(update: Update<T>): void {
    if (
      this.derivedFrom &&
      this.derivedFrom.selectors.every((selector) => typeof selector === 'string')
    ) {
      const path = this.derivedFrom.selectors.join('.');

      if (update instanceof Function) {
        const before = this.get();
        update = update(before);
      }

      this.derivedFrom.store.update((before: any) => set<any, any>(before, path, update));
      return;
    }

    if (this.getter instanceof Function) {
      throw new TypeError(
        'Can only updated computed stores that are derived from other stores using string selectors',
      );
    }

    if (update instanceof Function) {
      update = update(this.get());
    }

    this._value = { v: update };
    this.notify();
  }

  protected invalidate() {
    this._value = undefined;

    if (this.isActive) {
      this.calculationHelper.execute();
    }
  }

  sub(listener: Listener<T>, options?: SubscribeOptions): Cancel {
    const { runNow = true, throttle: throttleOption, equals = defaultEquals } = options ?? {};

    let compareToValue = this.get();
    let previousValue: T | undefined;
    let hasRun = false;

    let innerListener = (force?: boolean | void) => {
      const value = this.get();

      if (!force && equals(value, compareToValue)) {
        return;
      }

      compareToValue = value;
      const _previousValue = previousValue;
      previousValue = value;
      hasRun = true;

      try {
        listener(value, _previousValue);
      } catch (error) {
        forwardError(error);
      }
    };

    if (throttleOption) {
      innerListener = throttle(innerListener, calcDuration(throttleOption));
    }

    this.listeners.add(innerListener);
    this.onSubscribe();

    if (runNow && !hasRun) {
      innerListener(true);
    }

    return () => {
      this.listeners.delete(innerListener);
      this.onUnsubscribe();
    };
  }

  map<S>(selector: Selector<T, S>, options?: UseOptions): Store<S>;

  map<P extends Path<T>>(selector: P, options?: UseOptions): Store<Value<T, P>>;

  map(_selector: Selector<T, any> | Path<any>, options?: UseOptions): Store<any> {
    const selector = makeSelector(_selector);
    const derivedFrom = { store: this, selectors: [_selector] };

    return new Store(
      ({ use }) => {
        return selector(use(this, options));
      },
      this.options,
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
  addEffect(effect: Effect, retain?: Duration) {
    this.effects.set(effect, {
      handle: this.listeners.size > 0 ? effect() ?? noop : undefined,
      retain: retain !== undefined ? calcDuration(retain) : undefined,
    });

    return () => {
      const { handle, timeout } = this.effects.get(effect) ?? {};
      handle?.();

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      this.effects.delete(effect);
    };
  }

  /** Return whether the store is currently active, which means whether it has at least one subscriber. */
  get isActive() {
    return this.listeners.size > 0;
  }

  protected onSubscribe() {
    if (this.listeners.size > 1) return;

    for (const [effect, { handle, retain, timeout }] of this.effects.entries()) {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      this.effects.set(effect, {
        handle: handle ?? effect() ?? noop,
        retain,
        timeout: undefined,
      });
    }
  }

  protected onUnsubscribe() {
    if (this.listeners.size > 0) return;

    for (const [effect, { handle, retain, timeout }] of this.effects.entries()) {
      if (!retain) {
        handle?.();
      }

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      this.effects.set(effect, {
        handle: retain ? handle : undefined,
        retain,
        timeout: retain && handle ? setTimeout(handle, retain) : undefined,
      });
    }
  }

  protected notify() {
    const n = {};
    this.notifyId = n;

    const snapshot = [...this.listeners];
    for (const listener of snapshot) {
      listener();
      if (n !== this.notifyId) break;
    }
  }
}

const defaultOptions: StoreOptions = {};

function _store<T>(
  calculate: (this: { use: Use }, fns: { use: Use }) => T,
  options?: StoreOptions,
): Store<T>;
// eslint-disable-next-line @typescript-eslint/ban-types
function _store<T, Actions extends StoreActions = {}>(
  initialState: T,
  options?: StoreOptionsWithActions<T, Actions>,
): StoreWithActions<T, Actions>;
function _store<T, Actions extends StoreActions>(
  initialState: T | ((this: { use: Use }, fns: { use: Use }) => T),
  options?: StoreOptionsWithActions<T, Actions>,
): StoreWithActions<T, Actions> | Store<T> {
  const store = new Store(initialState, options);

  if (initialState instanceof Function) {
    return store;
  }

  let methods: StoreActions | undefined = options?.methods;

  if (initialState instanceof Map) {
    methods = { ...mapActions, ...methods };
  } else if (initialState instanceof Set) {
    methods = { ...setActions, ...methods };
  } else if (Array.isArray(initialState)) {
    methods = { ...arrayActions, ...methods };
  } else if (initialState instanceof Object) {
    methods = { ...recordActions, ...methods };
  }

  const boundActions = Object.fromEntries(
    Object.entries(methods ?? ({} as BoundStoreActions<T, any>))
      .filter(([name]) => !(name in store))
      .map(([name, action]) => [name, (action as any).bind(store)]),
  ) as BoundStoreActions<T, any>;

  return Object.assign(store, boundActions);
}

export const store = Object.assign(_store, { defaultOptions });
