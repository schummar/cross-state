import { useRef, useState } from 'react';
import { Action } from './action';
import useEarlyEffect from './useEarlyEffect';
import useEqualityRef from './useEqualityRef';

export function useAction<Arg, Value>(action: Action<Arg, Value>, arg: Arg) {
  const value = useRef<Value>();
  const [, setVersion] = useState(0);

  useEarlyEffect(() => {
    value.current = action.getCached(arg);
    if (!value.current) action.run(arg);

    return action.subscribe(arg, (newValue) => {
      value.current = newValue.result?.value;
      setVersion((version) => version + 1);
    });
  }, [useEqualityRef(arg)]);

  return value.current;
}
