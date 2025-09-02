import { Store, type Duration, type StoreOptions } from '@core';

export interface UrlStoreOptions<T> extends Omit<StoreOptions<T>, 'persist'> {
  key: string;
  type?: 'search' | 'hash';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  defaultValue: T;
  writeDefaultValue?: boolean;
  onCommit?: (value: T ) => void;
  debounce?: Duration;
  persist?: { id: string };
}

export interface UrlStoreOptionsWithoutDefaults<T>
  extends Omit<UrlStoreOptions<T | undefined>, 'defaultValue'> {
  defaultValue?: T | undefined;
}

export class UrlStore<T> extends Store<T> {
  urlOptions: Exclude<UrlStoreOptions<T>, StoreOptions<T>>;
  urlRefs: Set<unknown> = new Set();
  isDirty?: boolean;

  constructor({
    key,
    type,
    serialize,
    deserialize,
    defaultValue,
    writeDefaultValue,
    onCommit,
    debounce,
    persist,
    ...options
  }: UrlStoreOptions<T>) {
    super(defaultValue, options);

    this.urlOptions = {
      key,
      type,
      serialize,
      deserialize,
      defaultValue,
      writeDefaultValue,
      onCommit,
      debounce,
      persist,
    };
  }
}

export function createUrlStore<T>(options: UrlStoreOptions<T>): UrlStore<T>;
export function createUrlStore<T>(
  options: UrlStoreOptionsWithoutDefaults<T>,
): UrlStore<T | undefined>;
export function createUrlStore<T>(options: UrlStoreOptionsWithoutDefaults<T>) {
  return new UrlStore({
    ...options,
    defaultValue: options.defaultValue as T,
  });
}
