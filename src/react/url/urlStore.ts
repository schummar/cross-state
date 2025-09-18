import type { UpdateFunction } from '@core';
import type { Location } from '@react/url/urlContext';
import { parseLocation } from '@react/url/urlHelpers';
import {
  createUrlOptions,
  type UrlOptions,
  type UrlOptionsWithoutDefaults,
} from '@react/url/urlOptions';
import { useUrlParam } from '@react/url/useUrlParam';

export class UrlStore<T> {
  constructor(public readonly options: Required<UrlOptions<T>>) {}

  useStore(): T {
    return useUrlParam(this)[0];
  }

  useProp(): [T, update: UpdateFunction<T>] {
    return useUrlParam(this);
  }

  parse(location: Location): T | undefined {
    const url = parseLocation(location);
    const params = new URLSearchParams(url[this.options.type].slice(1));
    const urlValue = params.get(this.options.key);
    return urlValue !== null ? this.options.deserialize(urlValue) : undefined;
  }
}
export function createUrlStore<T>(options: UrlOptions<T>): UrlStore<T>;
export function createUrlStore<T>(options: UrlOptionsWithoutDefaults<T>): UrlStore<T | undefined>;
export function createUrlStore<T>(options: UrlOptionsWithoutDefaults<T>) {
  return new UrlStore(createUrlOptions(options));
}
