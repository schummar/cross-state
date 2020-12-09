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
};

export function useAction<Arg, Value>(
  action: Action<Arg, Value>,
  arg: Arg,
  { watchOnly, updateOnMount, clearBeforeUpdate }: UseActionOptions = {}
): [Value | undefined, { error?: unknown; isLoading: boolean }] {
  const [value, setValue] = useState(() => action.getCachedValue(arg));
  const [error, setError] = useState(() => action.getCacheError(arg));
  const [isLoading, setIsLoading] = useState(() => !!action.getCached(arg)?.inProgress);

  useEffect(() => {
    return action.subscribe(
      arg,
      ({ current, inProgress }) => {
        setValue(current?.kind === 'value' ? current.value : undefined);
        setError(current?.kind === 'error' ? current.error : undefined);
        setIsLoading(!!inProgress);

        if (watchOnly) return;
        if (!current && !inProgress) {
          action.run(arg, { clearBeforeUpdate });
        }
      },
      true
    );
  }, [action, useEqualityRef(arg)]);

  useEffect(() => {
    if (updateOnMount) action.run(arg, { clearBeforeUpdate });
  }, []);

  return [value, { error, isLoading }];
}
