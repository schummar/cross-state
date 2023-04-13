import type { Store } from './store';
import type { DebounceOptions } from '@lib/debounce';
import { type MaybePromise } from '@lib/maybePromise';

export interface Listener<T = void> {
  (value: T, previouseValue?: T): void;
}

export interface Selector<T, S> {
  (value: T): S;
}

export interface Effect {
  (): void | Cancel;
}

export interface SubscribeOptions {
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
  tag?: any;
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

export type UpdateFrom<Value, From extends any[]> = Value | ((...args: From) => Value);
export type Update<Value> = UpdateFrom<Value, [Value]>;

export interface UpdateFunction<Value> {
  (update: Update<Value>): void;
}

export interface Use {
  <T>(store: Store<T>): T;
}

export type ConnectionState = 'connecting' | 'open' | 'closing' | 'closed';

export interface CalculationHelpers<T> {
  use: Use;
  updateValue: (update: UpdateFrom<MaybePromise<T>, [T | undefined]>) => void;
  updateError: (error: unknown) => void;
  updateConnectionState: (state: ConnectionState) => void;
}
