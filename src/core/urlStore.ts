import { type Cancel, type DisposableCancel, type Duration } from './commonTypes';
import { createStore, type Store, type StoreOptions } from './store';
import { debounce } from '@lib/debounce';
import disposable from '@lib/disposable';
import { fromExtendedJsonString, toExtendedJsonString } from '@lib/extendedJson';
import { persist, type PersistOptions } from '@persist/persist';

export interface UrlStoreOptions<T> extends StoreOptions<T | undefined> {
  key: string;
  type?: 'search' | 'hash';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  defaultValue?: T;
  writeDefaultValue?: boolean;
  onCommit?: (value: T | undefined) => void;
  debounce?: Duration;
  persist?: PersistOptions<T | undefined> & {
    onlyWhenActive?: boolean;
  };
}

export interface UrlStoreOptionsWithDefaults<T> extends UrlStoreOptions<T> {
  defaultValue: T;
}

export type UrlStoreOptionsRequired<T> = UrlStoreOptions<T> &
  Required<Pick<UrlStoreOptions<T>, 'type' | 'serialize' | 'deserialize' | 'defaultValue'>>;

const urlStore = createStore<string>(({ use }) => {
  return use({
    get() {
      return typeof window !== 'undefined' ? window.location.href : '';
    },
    subscribe(listener) {
      if (typeof window === 'undefined') {
        return () => undefined;
      }

      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      const update = () => {
        listener(window.location.href);
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
    },
    invalidate() {},
  });
});

export function updateUrlStore(): void {
  urlStore.set(window.location.href);
}

function defaultDeserializer(value: string): any {
  if (value === undefined) {
    return undefined;
  }

  try {
    return fromExtendedJsonString(value);
  } catch {
    return undefined;
  }
}

function defaultSerializer(value: any): string {
  return toExtendedJsonString(value);
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
    writeDefaultValue,
    onCommit,
    debounce: debounceTime = 500,
    persist: persistOptions,
  }: UrlStoreOptions<T>,
): DisposableCancel {
  const serializedDefaultValue = defaultValue !== undefined ? serialize(defaultValue) : undefined;
  let isDirty = false;
  let isSettingFromUrl = false;

  const commit = debounce(() => {
    if (!isDirty) {
      return;
    }

    const value = store.get();
    const url = new URL(urlStore.get());
    const parameters = new URLSearchParams(url[type].slice(1));
    const serializedValue = value !== undefined ? serialize(value) : undefined;

    if (
      serializedValue === undefined ||
      (!writeDefaultValue && serializedValue === serializedDefaultValue)
    ) {
      parameters.delete(key);
    } else {
      parameters.set(key, serializedValue);
    }

    url[type] = parameters.toString();

    window.history.replaceState(window.history.state, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));

    onCommit?.(value);
    isDirty = false;
  }, debounceTime);

  const cancelUrlListener = urlStore.subscribe((_url) => {
    if (isDirty) {
      return;
    }

    const url = new URL(_url);
    const parameters = new URLSearchParams(url[type].slice(1));
    const urlValue = parameters.get(key);

    isSettingFromUrl = true;
    store.set(urlValue !== null ? deserialize(urlValue) : defaultValue);
    isSettingFromUrl = false;
  });

  const cancelSubscription = store.subscribe(
    () => {
      if (isSettingFromUrl) {
        return;
      }

      isDirty = true;
      commit();
    },
    { runNow: writeDefaultValue ?? false, passive: true },
  );

  function startPersist(persistOptions: PersistOptions<T>) {
    const url = new URL(urlStore.get());
    const parameters = new URLSearchParams(url[type].slice(1));
    const isUrlSet = parameters.get(key) !== null;

    const p = persist(store, {
      ...persistOptions,
      persistInitialState: isUrlSet,
    });
    return () => p.stop();
  }

  let cancelPersistence: Cancel | undefined;
  if (persistOptions?.onlyWhenActive) {
    cancelPersistence = store.addEffect(() => startPersist(persistOptions));
  } else if (persistOptions) {
    cancelPersistence = startPersist(persistOptions);
  }

  return disposable(() => {
    cancelUrlListener();
    cancelSubscription();
    cancelPersistence?.();
    commit.flush();
  });
}

export function createUrlStore<T>(options: UrlStoreOptionsWithDefaults<T>): Store<T>;

export function createUrlStore<T>(options: UrlStoreOptions<T>): Store<T | undefined>;

export function createUrlStore<T>({
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
  const store = createStore(defaultValue, options);

  connectUrl(store, {
    key,
    type,
    serialize,
    deserialize,
    defaultValue,
    writeDefaultValue,
    onCommit,
    debounce,
    persist,
  });

  return store;
}
