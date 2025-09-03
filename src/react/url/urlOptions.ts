export interface UrlOptions<T> {
  key: string;
  type?: 'search' | 'hash';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  defaultValue: T;
  writeDefaultValue?: boolean;
  onCommit?: (value: T) => void;
  persist?: { id: string };
}

export interface UrlOptionsWithoutDefaults<T>
  extends Omit<UrlOptions<T | undefined>, 'defaultValue'> {
  defaultValue?: T | undefined;
}

export function createUrlOptions<T>(options: UrlOptions<T>): UrlOptions<T>;
export function createUrlOptions<T>(
  options: UrlOptionsWithoutDefaults<T>,
): UrlOptions<T | undefined>;
export function createUrlOptions<T>(options: UrlOptionsWithoutDefaults<T>) {
  return {
    ...options,
    defaultValue: options.defaultValue as T,
  };
}
