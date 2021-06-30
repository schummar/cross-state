import { useEffect, useMemo, useState } from 'react';
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
};

export type UseActionReturn<Value> = [Value | undefined, { error?: unknown; isLoading: boolean }];

const ignore = () => {
  //ignore
};

export function useAction<Arg, Value>(
  action: Action<Arg, Value>,
  arg: Arg,
  { watchOnly, updateOnMount, clearBeforeUpdate, dormant, throttle }: UseActionOptions = {}
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

    return action.subscribe(
      arg,
      () => {
        setCounter((c) => c + 1);
        if (!watchOnly) action.get(arg).catch(ignore);
      },
      { runNow: true, throttle }
    );
  }, [action, useEqualityRef(arg), watchOnly, dormant, throttle]);

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
