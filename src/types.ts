export interface Listener<T> {
  (value: T): void;
}

export interface Effect {
  (): void | Cancel;
}

export interface SubscribeOptions {
  runNow?: boolean;
  throttle?: number;
  equals?: (a: any, b: any) => boolean;
}

export interface Cancel {
  (): void;
}

export type Time = number | { milliseconds?: number; seconds?: number; minutes?: number; hours?: number; days?: number };

export interface Store<Value> {
  get(): Value;
  subscribe(listener: Listener<Value>, options?: SubscribeOptions): Cancel;
  addEffect(effect: Effect, retain?: Time): Cancel;
  readonly isActive: boolean;
}

export type Update<Value> = Value | ((value: Value) => Value);

export interface UpdateFn<Value> {
  (update: Update<Value>): void;
}

export interface BaseStore<Value> extends Store<Value> {
  set: UpdateFn<Value>;
}
