import { useEffect, useMemo, useState } from 'react';
import { DebounceOptions } from '../helpers/debounce';
import { Action } from './action';
import useEqualityRef from './useEqualityRef';

export type UseActionOptions = {
  /** Watch value without triggering loading it */
  watchOnly?: boolean;
  /**  */
  updateOnMount?: boolean;
  /**  */
  clearBeforeUpdate?: boolean;
  /** */
  dormant?: boolean;
  /** */
  throttle?: number;
  debounce?: number | DebounceOptions;
};

export type UseActionReturn<Value> = [Value | undefined, { error?: unknown; isLoading: boolean }];

const ignore = () => {
  //ignore
};

export function useAction<Arg, Value>(
  action: Action<Arg, Value>,
  arg: Arg,
  { watchOnly, updateOnMount, clearBeforeUpdate, dormant, throttle, debounce }: UseActionOptions = {}
): UseActionReturn<Value> {
  // This counter is incremented when the action notifies about changes, in order to trigger another render
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    if (updateOnMount && !dormant) action.execute(arg, { clearBeforeUpdate }).catch(ignore);
  }, []);

  useEffect(() => {
    if (dormant) {
      return;
    }

    if (!watchOnly) action.get(arg).catch(ignore);

    return action.subscribe(
      arg,
      () => {
        setCounter((c) => c + 1);
        if (!watchOnly) action.get(arg).catch(ignore);
      },
      { runNow: true, throttle, debounce }
    );
  }, [action, useEqualityRef(arg), watchOnly, dormant, throttle, debounce]);

  // This value therefore updates when either the action changes or the action notifies

  return useMemo(() => {
    if (dormant) {
      return [undefined, { error: undefined, isLoading: false }];
    }

    const instance = action.getCache(arg);

    return [
      instance?.current?.kind === 'value' ? instance.current.value : undefined,
      { error: instance?.current?.kind === 'error' ? instance.current.error : undefined, isLoading: !!instance?.inProgress },
    ];
  }, [action, useEqualityRef(arg), dormant, counter]);
}
