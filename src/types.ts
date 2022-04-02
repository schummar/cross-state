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

export interface Store<Value> {
  get(): Value;
  subscribe(listener: Listener<Value>, options?: SubscribeOptions): Cancel;
  addEffect(effect: Effect): Cancel;
  readonly isActive: boolean;
}

export type Update<Value> = Value | ((value: Value) => Value);

export interface UpdateFn<Value> {
  (update: Update<Value>): void;
}

export interface AtomicStore<Value> extends Store<Value> {
  set: UpdateFn<Value>;
}
