import { useEffect, useState } from 'react';
import { Action } from './action';
import useEqualityRef from './useEqualityRef';

export function useAction<Arg, Value>(action: Action<Arg, Value>, arg: Arg): [Value | undefined, { error?: unknown; isLoading: boolean }] {
  const [value, setValue] = useState(() => action.getCachedValue(arg));
  const [error, setError] = useState(() => action.getCacheError(arg));
  const [isLoading, setIsLoading] = useState(() => !!action.getCached(arg)?.inProgress);

  useEffect(() => {
    return action.subscribe(arg, ({ current, inProgress }) => {
      setValue(current?.kind === 'value' ? current.value : undefined);
      setError(current?.kind === 'error' ? current.error : undefined);
      setIsLoading(!!inProgress);

      if (!current && !inProgress) {
        action.run(arg);
      }
    });
  }, [action, useEqualityRef(arg)]);

  return [value, { error, isLoading }];
}
