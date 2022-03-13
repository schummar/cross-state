export interface Listener<T> {
  (value: T): void;
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
}
