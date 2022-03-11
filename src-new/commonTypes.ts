export interface Listener<T> {
  (value: T): void;
}

export interface SubscribeOptions {
  runNow?: boolean;
  throttle?: number;
}

export interface Cancel {
  (): void;
}

export interface Store<Value> {
  subscribe(listener: Listener<Value>, options?: SubscribeOptions): Cancel;
  get(): Value;
}
