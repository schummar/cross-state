import type {
  Cancel,
  DisposableCancel,
  Duration,
  Effect,
  EffectRecord,
  MakeOptional,
  ReadStore,
  SubscribeOptions,
  WriteStore,
} from '@core/commonTypes';
import type { Constrain } from '@lib/constrain';
import { debounce } from '@lib/debounce';
import disposable from '@lib/disposable';
import { calcDuration } from '@lib/duration';
import { deepEqual } from '@lib/equals';
import { forwardError } from '@lib/forwardError';
import type { AnyPath, SettablePath, Value } from '@lib/path';
import { get, set } from '@lib/propAccess';
import { throttle } from '@lib/throttle';

export interface StoreOptions<T> {
  retain?: Duration;
  equals?: SubscribeOptions['equals'];
  effect?: Effect<T> | { effect: Effect<T>; retain?: Duration };
  cacheValue?: boolean;
}

export interface OnceOptions {
  signal?: AbortSignal;
  timeout?: Duration;
}

export interface OnceResult<T> extends Promise<T> {
  cancel: (reason?: unknown) => void;
}

abstract class BaseStore<T> implements ReadStore<T> {
  protected listeners: Set<() => void> = new Set<() => void>();
  protected effects: Set<EffectRecord<this>> = new Set<EffectRecord<this>>();
  protected notifyId = {};

  constructor(protected baseStoreOptions?: StoreOptions<BaseStore<T>>) {}

  abstract get(): T;

  protected notify(): void {
    const id = (this.notifyId = {});
    for (const listener of Array.from(this.listeners)) {
      if (this.notifyId !== id) {
        break;
      }

      listener();
    }
  }

  simpleSubscribe(listener: () => void): DisposableCancel {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.startEffects();
    }

    return disposable(() => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopEffects();
      }
    });
  }

  subscribe(
    listener: (this: { cancel: Cancel }, value: T, previousValue: T | undefined) => void,
    options: SubscribeOptions = {},
  ): DisposableCancel {
    const { runNow = true, equals = this.baseStoreOptions?.equals ?? deepEqual } = options;
    let value = runNow ? undefined : { v: this.get() };

    let internalListener = () => {
      const newValue = this.get();
      if (!value || !equals(newValue, value.v)) {
        try {
          listener.apply({ cancel }, [newValue, value?.v]);
        } catch (error) {
          forwardError(error);
        }

        value = { v: newValue };
      }
    };

    if (options.throttle !== undefined) {
      internalListener = throttle(internalListener, options.throttle);
    } else if (options.debounce !== undefined) {
      internalListener = debounce(internalListener, options.debounce);
    }

    const cancel = this.simpleSubscribe(internalListener);

    if (runNow ?? true) {
      internalListener();
    }

    options.signal?.addEventListener('abort', () => {
      cancel();
    });

    return cancel;
  }

  once<S extends T>(condition: (value: T) => value is S, options?: OnceOptions): OnceResult<S>;

  once(condition: (value: T) => boolean, options?: OnceOptions): OnceResult<T>;

  once(options?: OnceOptions): OnceResult<Exclude<T, undefined>>;

  once(
    ...args: [condition: (value: any) => boolean, options?: OnceOptions] | [options?: OnceOptions]
  ): OnceResult<any> {
    const condition = args[0] instanceof Function ? args[0] : (x: T) => x !== undefined;
    const options = args[0] instanceof Function ? args[1] : args[0];
    const ac = new AbortController();

    options?.signal?.addEventListener('abort', () => {
      ac.abort(ac.signal.reason ?? 'signal');
    });

    if (options?.timeout !== undefined) {
      const timer = setTimeout(() => ac.abort('timeout'), calcDuration(options.timeout));
      ac.signal.addEventListener('abort', () => clearTimeout(timer));
    }

    const promise = new Promise<T>((resolve, reject) => {
      this.subscribe(
        (value) => {
          if (!condition(value)) {
            return;
          }

          resolve(value);
          ac.abort();
        },
        {
          signal: ac.signal,
        },
      );

      ac.signal.addEventListener('abort', () => {
        reject(ac.signal.reason);
      });
    });

    return Object.assign(promise, {
      cancel(reason?: unknown) {
        ac.abort(reason);
      },
    });
  }

  isActive(): boolean {
    return this.listeners.size > 0;
  }

  addEffect(effect: Effect<this>): DisposableCancel {
    const effectRecord: EffectRecord<this> = { run: effect };
    this.effects.add(effectRecord);

    if (this.isActive()) {
      effectRecord.cancel = effect.apply(this, [this]);
    }

    return disposable(() => {
      this.effects.delete(effectRecord);

      if (effectRecord.cancel) {
        effectRecord.cancel();
      }
    });
  }

  protected startEffects(): void {
    for (const effect of this.effects) {
      if (!effect.cancel) {
        effect.cancel = effect.run.apply(this, [this]);
      }
    }
  }

  protected stopEffects(): void {
    for (const effect of this.effects) {
      if (effect.cancel) {
        effect.cancel();
        delete effect.cancel;
      }
    }
    return;
  }
}

export class Atom<T> extends BaseStore<T> implements ReadStore<T>, WriteStore<T> {
  constructor(
    protected _value: T,
    options?: StoreOptions<Atom<T>>,
  ) {
    super(options as any);
  }

  get(): T {
    return this._value;
  }

  set(value: T): void;
  set(update: (value: T) => T): void;
  set<const P>(path: Constrain<P, SettablePath<T>>, value: Value<T, P>): void;
  set<const P>(
    path: Constrain<P, SettablePath<T>>,
    update: (value: Value<T, P>) => Value<T, P>,
  ): void;
  set(...args: any[]): void {
    const path = args.length === 2 ? (args[0] as AnyPath) : [];
    let update: T | ((value: T) => T) = args.length === 2 ? args[1] : args[0];
    const oldValue = this.get();

    if (typeof update === 'function') {
      const value = get<any, any>(oldValue, path);
      update = (update as (value: any) => any)(value);
    }

    this._value = set<any, any>(oldValue, path, update);
    this.notify();
  }
}

export function createStore<T>(initialValue: T, options?: StoreOptions<Atom<T>>): Atom<T> {
  return new Atom(initialValue, options);
}

export type ComputedDependencies<TDeps extends any[]> = { [K in keyof TDeps]: ReadStore<TDeps[K]> };

interface ComputedOptions<T, TDeps extends any[]> {
  dependencies: ComputedDependencies<TDeps>;
  compute: (...deps: TDeps) => T;
}

type ComputedOptionsInput<T, TDeps extends any[]> = TDeps extends []
  ? MakeOptional<ComputedOptions<T, TDeps>, 'dependencies'>
  : ComputedOptions<T, TDeps>;

export class Computed<T, TDeps extends any[] = []> extends BaseStore<T> implements ReadStore<T> {
  protected cachedValue?: { value: T };

  constructor(protected options: ComputedOptions<T, TDeps>) {
    super();

    for (const dep of this.options.dependencies) {
      const ref = new WeakRef(this);

      const cancel = dep.subscribe(() => {
        const self = ref.deref();

        if (self) {
          self.invalidate();
        } else {
          cancel();
        }
      });
    }
  }

  get(): T {
    if (!this.cachedValue) {
      const deps = this.options.dependencies.map((dep) => dep.get()) as TDeps;
      this.cachedValue = { value: this.options.compute(...deps) };
    }

    return this.cachedValue.value;
  }

  invalidate(): void {
    this.cachedValue = undefined;
    this.notify();
  }
}

export function createComputedStore<T>(compute: () => T): Computed<T, []>;
export function createComputedStore<T, TDeps extends any[]>(
  options: ComputedOptionsInput<T, TDeps>,
): Computed<T, TDeps>;
export function createComputedStore<T, TDeps extends any[]>(
  arg: (() => T) | ComputedOptionsInput<T, TDeps>,
): Computed<T, TDeps> {
  if (typeof arg === 'function') {
    return new Computed<T, TDeps>({
      dependencies: [] as ComputedDependencies<TDeps>,
      compute: arg,
    });
  } else {
    return new Computed<T, TDeps>({
      ...arg,
      dependencies: arg.dependencies ?? [],
    } as ComputedOptions<T, TDeps>);
  }
}

class Mapped<T, K extends keyof T> extends Computed<T[K], [T]> implements WriteStore<T[K]> {
  constructor(
    protected source: ReadStore<T> & WriteStore<T>,
    protected key: K,
  ) {
    super({
      dependencies: [source],
      compute: (sourceValue) => sourceValue[key],
    });
  }

  set(newValue: T[K]): void {
    this.source.set({
      ...this.source.get(),
      [this.key]: newValue,
    });
  }
}

export function createMapped<T, K extends keyof T>(
  source: ReadStore<T> & WriteStore<T>,
  key: K,
): Mapped<T, K> {
  return new Mapped(source, key);
}
