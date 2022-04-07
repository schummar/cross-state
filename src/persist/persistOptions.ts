import { PersistPath } from './persistPath';

export interface PersistOptions<T> {
  id: string;
  paths?: (PersistPath<T> | { path: PersistPath<T>; throttle?: number })[];
  throttle?: number;
}
