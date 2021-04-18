import { Store as BaseStore } from '../store';
import { useStoreState } from './useStoreState';

export class Store<T> extends BaseStore<T> {
  useState(options?: { throttle?: number }): T;
  useState<S>(selector: (state: T) => S, dependencies?: any[], options?: { throttle?: number }): S;
  useState(...args: any[]): any {
    return useStoreState(this, ...args);
  }
}
