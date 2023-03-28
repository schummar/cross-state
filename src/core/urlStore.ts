import { Store, type StoreOptions } from './store';
import { debounce } from '@lib/debounce';
import { throttle } from '@lib/throttle';

export interface UrlStoreOptions<T> extends StoreOptions {
  key: string;
  type: 'search' | 'hash';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  debounce?: number;
  throttle?: number;
}

export class UrlStore<T> extends Store<T | undefined> {
  constructor(public readonly options: UrlStoreOptions<T>) {
    super(() => {
      const url = new URL(window.location.href);
      const parameters = new URLSearchParams(url[options.type].slice(1));
      const urlValue = parameters.get(options.key);
      const deserialize: (value: string) => T = options.deserialize ?? defaultDeserializer;
      return urlValue !== null ? deserialize(urlValue) : undefined;
    });

    if (options.debounce) {
      this.updateUrl = debounce(this.updateUrl, options.debounce);
    } else if (options.throttle) {
      this.updateUrl = throttle(this.updateUrl, options.throttle);
    }

    this.addEffect(() => this.watchUrl());
  }

  override set(value: T | undefined) {
    super.set(value);
    this.updateUrl(value);
  }

  protected watchUrl() {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = (...args) => {
      this.reset();
      originalPushState.apply(window.history, args);
    };

    window.history.replaceState = (...args) => {
      this.reset();
      originalReplaceState.apply(window.history, args);
    };

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }

  protected updateUrl(value: T | undefined) {
    const url = new URL(window.location.href);
    const parameters = new URLSearchParams(url[this.options.type].slice(1));
    const serialize: (value: T) => string = this.options.serialize ?? defaultSerializer;

    if (value === undefined) {
      parameters.delete(this.options.key);
    } else {
      parameters.set(this.options.key, serialize(value));
    }

    url[this.options.type] = parameters.toString();
    window.history.replaceState(null, '', url.toString());
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

export function createUrlStore<T>(options: UrlStoreOptions<T>) {
  return new UrlStore(options);
}
