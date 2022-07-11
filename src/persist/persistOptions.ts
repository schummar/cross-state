import type { PersistPath } from './persistPath';

export interface PersistOptions<T> {
  id: string;
  paths?: ('' | PersistPath<T>)[];
  throttle?: number;
  onError?: (e: unknown, action: 'loadKeys' | 'loadItem' | 'saveItem', key?: string) => void;
}
