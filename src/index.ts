export * from './baseStore';
export * from './useAction';
export * from './useStoreState';

import fastDeepEqual from 'fast-deep-equal';
import produce, { freeze, PatchListener } from 'immer';
import { Action as _Action } from './action';
import { BaseStore } from './baseStore';
import { useAction, UseActionOptions } from './useAction';
import { useStoreState } from './useStoreState';

export class Action<Arg, Value> extends _Action<Arg, Value> {
  useAction(arg: Arg, options: UseActionOptions = {}): [Value | undefined, { error?: unknown; isLoading: boolean }] {
    return useAction(this, arg, options);
  }
}

export class Store<T> extends BaseStore<T, [recipe: (draft: T) => void, listener?: PatchListener]> {
  constructor(state: T) {
    super(freeze(state, true), {
      equals: fastDeepEqual,
      update: produce,
      freeze: (state) => freeze(state, true),
    });
  }

  useState(): T;
  useState<S>(selector: (state: T) => S, dependencies?: any[]): S;
  useState<S>(selector: (state: T) => S = (x) => x as any, deps?: any[]): S {
    return useStoreState(this, selector, deps);
  }
}
