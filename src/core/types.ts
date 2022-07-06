export interface Listener<T> {
  (value: T): void;
}

export interface Effect {
  (): void | Cancel;
}

export interface SubscribeOptions {
  /** Whether to execute the callback immediately with the current store value.
   * @default true
   */
  runNow?: boolean;
  /** If set, throttle how often the callback can be executed.
   * The values says how much time needs to pass between to calls.
   * @example
   * subscribe(callback, { throttle: { seconds: 10 } }); // Will execute immediately and then at least 10 seconds havbe to pass. If the store changed during those 10 seconds, the callback will be executed again.
   */
  throttle?: Duration;
  /** Provide a custom equality function. By default a strict equals (===) will be used.
   */
  equals?: (a: any, b: any) => boolean;
}

export interface Cancel {
  (): void;
}

export type Duration =
  | number
  | {
      milliseconds?: number;
      seconds?: number;
      minutes?: number;
      hours?: number;
      days?: number;
    };

export interface Store<Value> {
  /** Get the current value. */
  get(): Value;
  /** Subscribe to updates. Every time the store's state changes, the callback will be executed with the new value. */
  subscribe(listener: Listener<Value>, options?: SubscribeOptions): Cancel;
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
  addEffect(effect: Effect, retain?: Duration): Cancel;
  /** Return whether the store is currently active, which means whether it has at least one subscriber. */
  isActive(): boolean;
  /** Create a copy of the store with the inital value. */
  recreate(): this;
}

export type Update<Value> = Value | ((value: Value) => Value);

export interface UpdateFn<Value> {
  (update: Update<Value>): void;
}
