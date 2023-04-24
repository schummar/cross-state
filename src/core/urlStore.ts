import { type Update } from './commonTypes';
import { Store, type StoreOptions } from './store';
import { type Path, type Value } from '@lib/path';

export interface UrlStoreOptions<T> extends StoreOptions {
  key: string;
  type?: 'search' | 'hash';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  defaultValue?: T;
  onCommit?: (value: T | undefined) => void;
}

export interface UrlStoreOptionsWithDefaults<T> extends UrlStoreOptions<T> {
  defaultValue: T;
}

export type UrlStoreOptionsRequired<T> = UrlStoreOptions<T> &
  Required<Pick<UrlStoreOptions<T>, 'type' | 'serialize' | 'deserialize' | 'defaultValue'>>;

export class UrlStore<T> extends Store<T> {
  private serializedDefaultValue = this.options.serialize(this.options.defaultValue);

  constructor(public readonly options: UrlStoreOptionsRequired<T>) {
    super(() => {
      const url = new URL(window.location.href);
      const parameters = new URLSearchParams(url[options.type].slice(1));
      const urlValue = parameters.get(options.key);
      const deserialize: (value: string) => T = options.deserialize ?? defaultDeserializer;
      return urlValue !== null ? deserialize(urlValue) : options.defaultValue;
    });

    this.addEffect(() => this.watchUrl());
  }

  override set(update: Update<T>): void;

  override set<P extends Path<T>>(path: P, update: Update<Value<T, P>>): void;

  override set(...args: any): void {
    super.set.apply(this, args);
    this.updateUrl(super.get());
  }

  protected watchUrl() {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = (...args) => {
      originalPushState.apply(window.history, args);
      this.reset();
    };

    window.history.replaceState = (...args) => {
      originalReplaceState.apply(window.history, args);
      this.reset();
    };

    window.addEventListener('popstate', this.reset);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', this.reset);
    };
  }

  protected updateUrl(value: T | undefined) {
    const url = new URL(window.location.href);
    const parameters = new URLSearchParams(url[this.options.type].slice(1));
    const serializedValue = value !== undefined ? this.options.serialize(value) : undefined;

    if (serializedValue === undefined || serializedValue === this.serializedDefaultValue) {
      parameters.delete(this.options.key);
    } else {
      parameters.set(this.options.key, serializedValue);
    }

    url[this.options.type] = parameters.toString();
    window.history.replaceState(null, '', url.toString());

    this.options.onCommit?.(value);
  }
}

function defaultDeserializer(value: string): any {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value, (_k, v) => {
      if (typeof v === 'object' && v !== null && '__set' in v) {
        return new Set(v.__set);
      }
      if (typeof v === 'object' && v !== null && '__map' in v) {
        return new Map(v.__map);
      }
      return v;
    });
  } catch {
    return undefined;
  }
}

function defaultSerializer(value: any): string {
  return JSON.stringify(value, (_k, v) => {
    if (v instanceof Set) {
      return { __set: Array.from(v) };
    }
    if (v instanceof Map) {
      return { __map: Array.from(v) };
    }
    return v;
  });
}

export function createUrlStore<T>(options: UrlStoreOptionsWithDefaults<T>): UrlStore<T>;
export function createUrlStore<T>(options: UrlStoreOptions<T>): UrlStore<T | undefined>;
export function createUrlStore<T>(options: UrlStoreOptions<T>) {
  return new UrlStore({
    ...options,
    type: options.type ?? 'search',
    serialize: options.serialize ?? defaultSerializer,
    deserialize: options.deserialize ?? defaultDeserializer,
    defaultValue: options.defaultValue ?? (undefined as T),
  });
}
