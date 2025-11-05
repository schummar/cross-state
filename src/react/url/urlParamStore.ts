import { createStore, Store, type Update } from '@core';
import { autobind } from '@lib/autobind';
import { castArray } from '@lib/castArray';
import type { Constrain } from '@lib/constrain';
import type { Path, Value } from '@lib/path';
import { get, set } from '@lib/propAccess';
import { normalizePath } from '@react/url/urlHelpers';
import {
  createUrlOptions,
  type UrlOptions,
  type UrlOptionsWithoutDefaults,
} from '@react/url/urlOptions';

export const urlStore: Store<string> = createStore(() => window.location.href, {
  cacheValue: false,
  effect() {
    const update = () => {
      if (window.location.href !== this.calculatedValue?.value) {
        this.invalidate();
      }
    };

    const interval = setInterval(update, 1);
    window.addEventListener('popstate', update);

    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', update);
    };
  },
});

export class UrlParamStore<T> extends Store<T> {
  readonly storageKey: string | null;
  private lastHref?: string;
  private lastStorageValue?: string | null;
  private lastValue?: T;

  constructor(public readonly urlOptions: Required<UrlOptions<T>>) {
    super(() => this.calc(), { cacheValue: false });
    autobind(UrlParamStore);

    this.storageKey =
      urlOptions.persist && `cross-state:url:${urlOptions.persist.id}:${urlOptions.key}`;
    this.addEffect(this.watch);
  }

  private watch() {
    let isActive = false;
    let urlValue = this.getUrlValue();
    let storageValue = this.getStorageValue();

    const update = () => {
      const oldIsActive = isActive;
      isActive = this.isPathActive();
      const oldUrlValue = urlValue;
      urlValue = this.getUrlValue();
      const oldStorageValue = storageValue;
      storageValue = this.getStorageValue();

      // If inactive => ignore changes
      if (!isActive) {
        return;
      }

      // No changes => ignore
      if (
        isActive === oldIsActive &&
        urlValue === oldUrlValue &&
        storageValue === oldStorageValue
      ) {
        return;
      }

      if (!oldIsActive) {
        // Became active =>
        // - if url has value => update storage
        // - else if storage has value or writeDefaultValue => update url
        if (urlValue !== null) {
          this.updateStorage(this.urlOptions.deserialize(urlValue));
        } else if (storageValue !== null) {
          this.updateUrl(this.urlOptions.deserialize(storageValue));
        } else if (this.urlOptions.writeDefaultValue) {
          this.updateUrl(this.urlOptions.defaultValue);
        }
      } else if (urlValue !== oldUrlValue) {
        // Url change while active =>
        // - if url has no value and writeDefaultValue => update url
        // - update storage
        if (urlValue === null && this.urlOptions.writeDefaultValue) {
          this.updateUrl(this.urlOptions.defaultValue);
        }

        this.updateStorage(
          urlValue !== null ? this.urlOptions.deserialize(urlValue) : this.urlOptions.defaultValue,
        );
      }

      this.invalidate();
    };

    const cancel = urlStore.subscribe(update);
    window.addEventListener('storage', update);

    return () => {
      cancel();
      window.removeEventListener('storage', update);
    };
  }

  private getUrlValue() {
    const href = urlStore.get();
    const url = new URL(href);
    const params = new URLSearchParams(url[this.urlOptions.type].slice(1) || '');
    return params.get(this.urlOptions.key);
  }

  private getStorageValue() {
    return this.storageKey !== null ? localStorage.getItem(this.storageKey) : null;
  }

  private isPathActive() {
    if (this.urlOptions.path === null) {
      return true;
    }

    const path = normalizePath(window.location.pathname);

    return castArray(this.urlOptions.path).some((p) => {
      if (typeof p === 'string') {
        return !p || p === path || path.startsWith(p + '/');
      }

      return p.test(path);
    });
  }

  private calc() {
    let href = window.location.href;
    const storageValue = this.storageKey !== null ? localStorage.getItem(this.storageKey) : null;

    if (!this.isPathActive() && this.lastHref !== undefined) {
      href = this.lastHref;
    }

    if (this.lastHref === href && this.lastStorageValue === storageValue) {
      return this.lastValue as T;
    }

    const url = new URL(href);
    const params = new URLSearchParams(url[this.urlOptions.type].slice(1));
    const urlValue = params.get(this.urlOptions.key);

    const value =
      urlValue !== null
        ? this.urlOptions.deserialize(urlValue)
        : this.storageKey !== null && storageValue !== null
          ? this.urlOptions.deserialize(storageValue)
          : this.urlOptions.defaultValue;

    this.lastHref = href;
    this.lastStorageValue = storageValue;
    this.lastValue = value;
    return value;
  }

  private updateUrl(value: T) {
    const serializedValue = this.urlOptions.serialize(value);

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url[this.urlOptions.type].slice(1));

    if (
      !this.urlOptions.writeDefaultValue &&
      serializedValue === this.urlOptions.serialize(this.urlOptions.defaultValue)
    ) {
      params.delete(this.urlOptions.key);
    } else {
      params.set(this.urlOptions.key, serializedValue);
    }

    url[this.urlOptions.type] = params.toString();
    window.history.replaceState(window.history.state, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private updateStorage(value: T) {
    if (this.storageKey === null) {
      return;
    }

    const serializedValue = this.urlOptions.serialize(value);
    localStorage.setItem(this.storageKey, serializedValue);
  }

  set(update: Update<T>): void;
  set<const P>(path: Constrain<P, Path<T>>, update: Update<Value<T, P>>): void;
  set(...args: any[]): void {
    const path: any = args.length > 1 ? args[0] : [];
    let update: Update<any> = args.length > 1 ? args[1] : args[0];

    if (update instanceof Function) {
      const before = this.get();
      const valueBefore = get(before, path);
      const valueAfter = update(valueBefore);
      update = set(before, path, valueAfter);
    } else if (path.length > 0) {
      update = set(this.get(), path, update);
    }

    if (this.isPathActive()) {
      this.updateUrl(update);
    } else {
      this.updateStorage(update);
    }
  }

  parse(path: string): T {
    const url = new URL(path, window.location.href);
    const params = new URLSearchParams(url[this.urlOptions.type].slice(1) || '');
    const urlValue = params.get(this.urlOptions.key);
    return urlValue !== null ? this.urlOptions.deserialize(urlValue) : this.urlOptions.defaultValue;
  }
}

export function createUrlParam<T>(options: UrlOptions<T>): UrlParamStore<T>;
export function createUrlParam<T>(
  options: UrlOptionsWithoutDefaults<T>,
): UrlParamStore<T | undefined>;
export function createUrlParam<T>(options: UrlOptionsWithoutDefaults<T>) {
  return new UrlParamStore(createUrlOptions(options));
}
