import useLatestRef from '@react/lib/useLatestRef';

export default function useLatestFunction<Args extends any[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const ref = useLatestRef(fn);

  return (...args: Args) => {
    return ref.current(...args);
  };
}
