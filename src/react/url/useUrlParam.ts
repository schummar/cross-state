import type { UpdateFunction } from '@core';
import { debounce } from '@lib/debounce';
import { useUrlContext } from '@react/url/urlContext';
import { defaultDeserializer, defaultSerializer } from '@react/url/urlSerializers';
import type { UrlStore } from '@react/url/urlStore';
import { useEffect, useMemo, useState } from 'react';

export function useUrlParam<T>(store: UrlStore<T>): [T, update: UpdateFunction<T>] {
  const {
    key,
    type = 'hash',
    serialize = defaultSerializer,
    deserialize = defaultDeserializer,
    defaultValue,
    writeDefaultValue,
    onCommit,
    debounce: debounceTime = 500,
    persist,
  } = store.urlOptions;

  const { href, navigate } = useUrlContext();
  const [localValue, setLocalValue] = useState<{ v: T } | undefined>(undefined);
  const value = useMemo(() => getCurrentValue(localValue), [href, localValue]);
  const storageKey = persist && `cross-state:url:${persist.id}:${key}`;

  function getUrlValue() {
    const url = new URL(href);
    const params = new URLSearchParams(url[type].slice(1));
    return params.get(key);
  }

  function getCurrentValue(localValue: { v: T } | undefined) {
    if (localValue) {
      return localValue.v;
    }

    const urlValue = getUrlValue();
    return urlValue === null ? defaultValue : deserialize(urlValue);
  }

  const commit = useMemo(
    () =>
      debounce((href: string) => {
        setLocalValue(undefined);
        const url = new URL(href);
        const params = new URLSearchParams(url[type].slice(1));
        const serializedValue = serialize(value);

        if (!writeDefaultValue && serializedValue === serialize(defaultValue)) {
          params.delete(key);
        } else {
          params.set(key, serializedValue);
        }

        url[type] = params.toString();
        navigate(url.toString());

        if (storageKey) {
          localStorage.setItem(storageKey, serializedValue);
        }

        onCommit?.(value);
      }, debounceTime),
    [debounceTime],
  );

  const update: UpdateFunction<T> = (update) => {
    if (update instanceof Function) {
      setLocalValue((localValue) => ({
        v: update(getCurrentValue(localValue)),
      }));
    } else {
      setLocalValue({ v: update });
    }
  };

  useEffect(() => {
    if (storageKey) {
      const urlValue = getUrlValue();
      if (urlValue === null) {
        const storageValue = localStorage.getItem(storageKey);
        if (storageValue !== null) {
          update(deserialize(storageValue));
        }
      }
    }

    return () => {
      commit.flush();
    };
  }, []);

  return [value, update];
}

// export function connectUrl<T>(
//   store: Store<T>,
//   options: UrlStoreOptionsWithDefaults<T>,
// ): DisposableCancel;

// export function connectUrl<T>(
//   store: Store<T | undefined>,
//   options: UrlStoreOptions<T>,
// ): DisposableCancel;

// export function connectUrl<T>(
//   store: Store<T>,
//   {
//     key,
//     type = 'search',
//     serialize = defaultSerializer,
//     deserialize = defaultDeserializer,
//     defaultValue = undefined as T,
//     writeDefaultValue,
//     onCommit,
//     debounce: debounceTime = 500,
//     persist: persistOptions,
//   }: UrlStoreOptions<T>,
// ): DisposableCancel {
//   const serializedDefaultValue = defaultValue !== undefined ? serialize(defaultValue) : undefined;
//   let isDirty = false;
//   let isSettingFromUrl = false;

//   const commit = debounce(() => {
//     if (!isDirty) {
//       return;
//     }

//     const value = store.get();
//     const url = new URL(urlStore.get());
//     const parameters = new URLSearchParams(url[type].slice(1));
//     const serializedValue = value !== undefined ? serialize(value) : undefined;

//     if (
//       serializedValue === undefined ||
//       (!writeDefaultValue && serializedValue === serializedDefaultValue)
//     ) {
//       parameters.delete(key);
//     } else {
//       parameters.set(key, serializedValue);
//     }

//     url[type] = parameters.toString();

//     window.history.replaceState(window.history.state, '', url.toString());
//     window.dispatchEvent(new PopStateEvent('popstate'));

//     onCommit?.(value);
//     isDirty = false;
//   }, debounceTime);

//   const cancelUrlListener = urlStore.subscribe((_url) => {
//     if (isDirty) {
//       return;
//     }

//     console.log('url', _url);

//     const url = new URL(_url);
//     const parameters = new URLSearchParams(url[type].slice(1));
//     const urlValue = parameters.get(key);

//     isSettingFromUrl = true;
//     store.set(urlValue !== null ? deserialize(urlValue) : defaultValue);
//     isSettingFromUrl = false;
//   });

//   const cancelSubscription = store.subscribe(
//     () => {
//       if (isSettingFromUrl) {
//         return;
//       }

//       isDirty = true;
//       commit();
//     },
//     { runNow: writeDefaultValue ?? false, passive: true },
//   );

//   function startPersist(persistOptions: PersistOptions<T>) {
//     const url = new URL(urlStore.get());
//     const parameters = new URLSearchParams(url[type].slice(1));
//     const isUrlSet = parameters.get(key) !== null;

//     const p = persist(store, {
//       ...persistOptions,
//       persistInitialState: isUrlSet,
//     });

//     console.log('start');
//     return () => {
//       console.log('stop');
//       p.stop();
//     };
//   }

//   let cancelPersistence: Cancel | undefined;
//   if (persistOptions?.onlyWhenActive) {
//     cancelPersistence = store.addEffect(() => startPersist(persistOptions));
//   } else if (persistOptions) {
//     cancelPersistence = startPersist(persistOptions);
//   }

//   return disposable(() => {
//     cancelUrlListener();
//     cancelSubscription();
//     cancelPersistence?.();
//     commit.flush();
//   });
// }
