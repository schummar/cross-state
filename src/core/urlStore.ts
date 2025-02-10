import disposable from '@lib/disposable';
import { type DisposableCancel, type Duration } from './commonTypes';
import { createStore, type Store, type StoreOptions } from './store';
import { debounce } from '@lib/debounce';

export interface UrlStoreOptions<T> extends StoreOptions<T | undefined> {
  key: string;
  type?: 'search' | 'hash';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  defaultValue?: T;
  onCommit?: (value: T | undefined) => void;
  debounce?: Duration;
}

export interface UrlStoreOptionsWithDefaults<T> extends UrlStoreOptions<T> {
  defaultValue: T;
}

export type UrlStoreOptionsRequired<T> = UrlStoreOptions<T> &
  Required<Pick<UrlStoreOptions<T>, 'type' | 'serialize' | 'deserialize' | 'defaultValue'>>;

const urlStore = createStore(() => (typeof window !== 'undefined' ? window.location.href : ''));

urlStore.addEffect(() => {
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  const update = () => {
    urlStore.set(window.location.href);
  };

  window.history.pushState = (...args) => {
    originalPushState.apply(window.history, args);
    update();
  };

  window.history.replaceState = (...args) => {
    originalReplaceState.apply(window.history, args);
    update();
  };

  window.addEventListener('popstate', update);

  return () => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', update);
  };
});

export function updateUrlStore(): void {
  urlStore.set(window.location.href);
}

export function connectUrl<T>(
  store: Store<T>,
  options: UrlStoreOptionsWithDefaults<T>,
): DisposableCancel;

export function connectUrl<T>(
  store: Store<T | undefined>,
  options: UrlStoreOptions<T>,
): DisposableCancel;

export function connectUrl<T>(
  store: Store<T>,
  {
    key,
    type = 'search',
    serialize = defaultSerializer,
    deserialize = defaultDeserializer,
    defaultValue = undefined as T,
    onCommit,
    debounce: debounceTime = 500,
  }: UrlStoreOptions<T>,
): DisposableCancel {
  const serializedDefaultValue = serialize(defaultValue);
  let isDirty = false;

  const commit = debounce(() => {
    if (isDirty) {
      const value = store.get();
      const url = new URL(window.location.href);
      const parameters = new URLSearchParams(url[type].slice(1));
      const serializedValue = value !== undefined ? serialize(value) : undefined;

      if (serializedValue === undefined || serializedValue === serializedDefaultValue) {
        parameters.delete(key);
      } else {
        parameters.set(key, serializedValue);
      }

      url[type] = parameters.toString();

      window.history.replaceState(window.history.state, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));

      onCommit?.(value);
      isDirty = false;
    }
  }, debounceTime);

  const cancelUrlListener = urlStore.subscribe((_url) => {
    if (isDirty) {
      return;
    }

    const url = new URL(_url);
    const parameters = new URLSearchParams(url[type].slice(1));
    const urlValue = parameters.get(key);

    store.set(urlValue !== null ? deserialize(urlValue) : defaultValue);
  });

  const cancelSubscription = store.subscribe(
    () => {
      isDirty = true;
      commit();
    },
    { runNow: false },
  );

  return disposable(() => {
    cancelUrlListener();
    cancelSubscription();
    commit.flush();
  });
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

export function createUrlStore<T>(options: UrlStoreOptionsWithDefaults<T>): Store<T>;

export function createUrlStore<T>(options: UrlStoreOptions<T>): Store<T | undefined>;

export function createUrlStore<T>(options: UrlStoreOptions<T>) {
  const store = createStore(options.defaultValue, options);
  connectUrl(store, options);
  return store;
}
