import { useEffect, useState } from 'react';
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
  holdPrevious?: boolean;
};

const ignore = () => {
  //ignore
};

export function useAction<Arg, Value>(
  action: Action<Arg, Value>,
  arg: Arg,
  { watchOnly, updateOnMount, clearBeforeUpdate, dormant, holdPrevious }: UseActionOptions = {}
): [Value | undefined, { error?: unknown; isLoading: boolean }] {
  const [value, setValue] = useState(() => (dormant ? undefined : action.getCacheValue(arg)));
  const [error, setError] = useState(() => (dormant ? undefined : action.getCacheError(arg)));
  const [isLoading, setIsLoading] = useState(() => !dormant && !!action.getCache(arg)?.inProgress);

  useEffect(() => {
    if (dormant) {
      setValue(undefined);
      setError(undefined);
      setIsLoading(false);
      return;
    }

    return action.subscribe(
      arg,
      ({ current, inProgress }) => {
        if (current || !holdPrevious) {
          setValue(current?.kind === 'value' ? current.value : undefined);
          setError(current?.kind === 'error' ? current.error : undefined);
        }
        setIsLoading(!!inProgress);

        if (!watchOnly) action.get(arg).catch(ignore);
      },
      { runNow: true }
    );
  }, [action, useEqualityRef(arg), watchOnly, clearBeforeUpdate, dormant, holdPrevious]);

  useEffect(() => {
    if (updateOnMount && !dormant) action.update(arg, { clearBeforeUpdate }).catch(ignore);
  }, []);

  return [value, { error, isLoading }];
}
