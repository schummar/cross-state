import type { DebounceOptions } from '@lib/debounce';
import { type MaybePromise } from '@lib/maybePromise';
import type { Store } from './store';

export interface Listener<T = void> {
  (value: T, previouseValue?: T): void;
}

export interface Selector<T, S> {
  (value: T): S;
}

export interface Effect<T> {
  (this: T, context: T): void | Cancel;
}

export interface SubscribeOptions {
  /** If set, this listener does not activate the store.
   * @default false
   */
  passive?: boolean;
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
  /** If set, callback execution is delayed. */
  debounce?: DebounceOptions;
  /** Provide a custom equality function. By default a strict equals (===) will be used.
   */
  equals?: (a: any, b: any) => boolean;
}

export interface Cancel {
  (): void;
}

export interface DisposableCancel {
  (): void;
  [Symbol.dispose](): void;
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

export type UpdateFrom<Value, From extends any[]> = Value | ((...args: From) => Value);
export type Update<Value> = UpdateFrom<Value, [Value]>;

export interface UpdateFunction<Value> {
  (update: Update<Value>): void;
}

export interface AsyncUpdateFunction<Value> {
  (update: UpdateFrom<MaybePromise<Value>, [Value]>): void;
}

export interface Use {
  <T>(store: Store<T>): T;
}

export interface BaseConnectionActions<T> {
  set: UpdateFunction<T>;
}

export interface AsyncConnectionActions<T> extends BaseConnectionActions<T> {
  updateValue: AsyncUpdateFunction<T>;
  updateError: (error: unknown) => void;
  updateIsConnected: (isConnected: boolean) => void;
  close: () => void;
}

export type ConnectionActions<T> = BaseConnectionActions<T> &
  (T extends Promise<infer S> ? AsyncConnectionActions<S> : {});

export interface Connection<T> {
  (actions: ConnectionActions<T>): Cancel;
}

export interface CalculationActions<T> {
  signal: AbortSignal;
  use: Use;
  connect(connection: Connection<T>): Promise<void>;
}
