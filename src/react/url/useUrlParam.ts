import type { UpdateFunction } from '@core';
import { debounce } from '@lib/debounce';
import { useUrlContext, type Location } from '@react/url/urlContext';
import type { UrlOptions, UrlOptionsWithoutDefaults } from '@react/url/urlOptions';
import { defaultDeserializer, defaultSerializer } from '@react/url/urlSerializers';
import { useEffect, useMemo, useState } from 'react';

export function useUrlParam<T>(options: UrlOptions<T>): [T, update: UpdateFunction<T>];
export function useUrlParam<T>(
  options: UrlOptionsWithoutDefaults<T>,
): [T | undefined, update: UpdateFunction<T | undefined>];
export function useUrlParam<T>(
  options: UrlOptionsWithoutDefaults<T>,
): [T, update: UpdateFunction<T>] {
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
  } = options as UrlOptions<T>;

  const { location, navigate } = useUrlContext();
  const url = parseLocation(location);
  const params = new URLSearchParams(url[type].slice(1));
  const urlValue = params.get(key);

  const storageKey = persist && createStorageKey(persist.id, key);
  const storageValue = storageKey ? localStorage.getItem(storageKey) : null;

  const [localValue, setLocalValue] = useState(() => {
    if (urlValue !== null) {
      return undefined;
    }
    if (storageValue !== null) {
      return { v: deserialize(storageValue) };
    }
    if (writeDefaultValue) {
      return { v: defaultValue };
    }
    return undefined;
  });

  const value = useMemo(() => getCurrentValue(localValue), [urlValue, localValue]);

  function getCurrentValue(localValue: { v: T } | undefined) {
    if (localValue) {
      return localValue.v;
    }

    return urlValue === null ? defaultValue : deserialize(urlValue);
  }

  const commitUrl = useMemo(
    () =>
      debounce((value: T) => {
        setLocalValue(undefined);
        const serializedValue = serialize(value);

        navigate((location) => {
          const url = parseLocation(location);
          const params = new URLSearchParams(url[type].slice(1));

          if (!writeDefaultValue && serializedValue === serialize(defaultValue)) {
            params.delete(key);
          } else {
            params.set(key, serializedValue);
          }

          url[type] = params.toString();
          return url.toString().replace(window.location.origin, '');
        });

        onCommit?.(value);
      }, debounceTime),
    [debounceTime],
  );

  const commitStorage = useMemo(
    () =>
      debounce((value: T) => {
        if (!storageKey) {
          return;
        }

        const serializedValue = serialize(value);
        localStorage.setItem(storageKey, serializedValue);
      }, debounceTime),
    [debounceTime],
  );

  const update: UpdateFunction<T> = (update) => {
    let newValue: T;

    if (update instanceof Function) {
      setLocalValue((localValue) => {
        newValue = update(getCurrentValue(localValue));
        return { v: newValue };
      });
    } else {
      newValue = update;
      setLocalValue({ v: newValue });
    }

    commitUrl(newValue!);
    commitStorage(newValue!);
  };

  useEffect(() => {
    if (urlValue !== null && !localValue) {
      commitStorage(deserialize(urlValue));
    }
  }, [urlValue, localValue]);

  useEffect(() => {
    if (localValue) {
      update(localValue.v);
    }

    return () => {
      commitUrl.cancel();
      commitStorage.flush();
    };
  }, []);

  return [value, update];
}

function parseLocation(location: Location) {
  if (typeof location !== 'string') {
    location = `${location.pathname}${location.search}${location.hash}`;
  }

  return new URL(location, window.location.origin);
}

export function createStorageKey(id: string, key: string) {
  return `cross-state:url:${id}:${key}`;
}
