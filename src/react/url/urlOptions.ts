import { defaultDeserializer, defaultSerializer } from '@react/url/urlHelpers';

export interface UrlOptions<T> {
  key: string;
  type?: 'search' | 'hash';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  defaultValue: T;
  writeDefaultValue?: boolean;
  onCommit?: (value: T) => void;
  persist?: { id: string } | null;
}

export interface UrlOptionsWithoutDefaults<T>
  extends Omit<UrlOptions<T | undefined>, 'defaultValue'> {
  defaultValue?: T | undefined;
}

export function createUrlOptions<T>(options: UrlOptions<T>): Required<UrlOptions<T>>;
export function createUrlOptions<T>(
  options: UrlOptionsWithoutDefaults<T>,
): Required<UrlOptions<T | undefined>>;
export function createUrlOptions<T>({
  key,
  type = 'hash',
  serialize = defaultSerializer,
  deserialize = defaultDeserializer,
  defaultValue = undefined as T,
  writeDefaultValue = false,
  onCommit = () => undefined,
  persist = null,
}: UrlOptionsWithoutDefaults<T>): Required<UrlOptionsWithoutDefaults<T>> {
  return {
    key,
    type,
    serialize,
    deserialize,
    defaultValue,
    writeDefaultValue,
    onCommit,
    persist,
  };
}
