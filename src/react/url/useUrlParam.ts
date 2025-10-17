import type { Update, UpdateFunction } from '@core';
import useLatestRef from '@react/lib/useLatestRef';
import { useUrlContext } from '@react/url/urlContext';
import { createStorageKey, parseLocation } from '@react/url/urlHelpers';
import {
  createUrlOptions,
  type UrlOptions,
  type UrlOptionsWithoutDefaults,
} from '@react/url/urlOptions';
import type { UrlStore } from '@react/url/urlStore';
import { useCallback, useEffect, useMemo } from 'react';

export function useUrlParam<T>(store: UrlStore<T>): [T, update: UpdateFunction<T>];
export function useUrlParam<T>(options: UrlOptions<T>): [T, update: UpdateFunction<T>];
export function useUrlParam<T>(
  options: UrlOptionsWithoutDefaults<T>,
): [T | undefined, update: UpdateFunction<T | undefined>];
export function useUrlParam<T>(
  input: UrlStore<T> | UrlOptionsWithoutDefaults<T>,
): [T, update: UpdateFunction<T>] {
  const { key, type, serialize, deserialize, defaultValue, writeDefaultValue, onCommit, persist } =
    createUrlOptions('options' in input ? input.options : (input as UrlOptions<T>));

  const { location, navigate } = useUrlContext();
  const url = parseLocation(location);
  const params = new URLSearchParams(url[type].slice(1));
  const urlValue = params.get(key);

  const storageKey = persist && createStorageKey(persist.id, key);
  const storageValue = storageKey ? localStorage.getItem(storageKey) : null;

  const value = useMemo(
    () =>
      urlValue !== null
        ? deserialize(urlValue)
        : storageValue !== null
          ? deserialize(storageValue)
          : defaultValue,
    [urlValue],
  );

  function commit(value: T) {
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

    if (storageKey) {
      localStorage.setItem(storageKey, serializedValue);
    }

    onCommit?.(value);
  }

  const latestValue = useLatestRef(value);
  const latestCommit = useLatestRef(commit);

  const update = useCallback((update: Update<T>) => {
    if (update instanceof Function) {
      update = update(latestValue.current);
    }

    latestCommit.current(update);
  }, []);

  useEffect(() => {
    if (urlValue !== null) {
      commit(deserialize(urlValue));
    }
  }, [urlValue]);

  useEffect(() => {
    if (urlValue === null && storageValue !== null) {
      commit(deserialize(storageValue));
    } else if (urlValue === null && writeDefaultValue) {
      commit(defaultValue);
    }
  }, []);

  return [value, update];
}
