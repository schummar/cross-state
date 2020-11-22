import { useEffect, useMemo, useRef } from 'react';
import { Unsubscribe } from './misc';

export default function useEarlyEffect(effect: React.EffectCallback, dependecies?: React.DependencyList) {
  const teardown = useRef<Unsubscribe | void>();

  useMemo(() => {
    if (teardown.current) teardown.current();
    teardown.current = effect();
  }, dependecies);

  useEffect(() => {
    if (teardown.current === undefined) {
      teardown.current = effect();
    }

    return () => {
      const t = teardown.current;
      teardown.current = undefined;
      if (t) t();
    };
  }, []);
}
