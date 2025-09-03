import {
  createUrlOptions,
  type UrlOptions,
  type UrlOptionsWithoutDefaults,
} from '@react/url/urlOptions';
import { useUrlParam } from '@react/url/useUrlParam';

export class UrlStore<T> {
  constructor(public readonly options: UrlOptions<T>) {}

  useStore(): T {
    return useUrlParam(this)[0];
  }

  useProp(): [T, update: (value: T) => void] {
    return useUrlParam(this);
  }
}
export function createUrlStore<T>(options: UrlOptions<T>): UrlStore<T>;
export function createUrlStore<T>(options: UrlOptionsWithoutDefaults<T>): UrlStore<T | undefined>;
export function createUrlStore<T>(options: UrlOptionsWithoutDefaults<T>) {
  return new UrlStore(createUrlOptions(options));
}
