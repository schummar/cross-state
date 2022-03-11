type AsyncStore<T> = Store<[value: T | undefined, isLoading: boolean, error?: unknown]> & {
  run(): Promise<T>;
};

function calc<Deps extends Store<any> | [Store<any>, ...Store<any>[]], T>(deps: Deps, fn: (...deps: StoreValues<Deps>) => T) {
  return {} as Store<T>;
}

function async<Arg = undefined, Value = unknown>(
  fn: (arg: Arg) => Promise<Value>,
  options?: {}
): (...[arg]: Arg extends undefined ? [arg?: Arg] : [arg: Arg]) => AsyncStore<Value>;
function async<Deps extends Store<any> | [Store<any>, ...Store<any>[]], Arg = undefined, Value = unknown>(
  deps: Deps,
  fn: (arg: Arg, ...deps: StoreValues<Deps>) => Promise<Value>,
  options?: {}
): (...[arg]: Arg extends undefined ? [arg?: Arg] : [arg: Arg]) => AsyncStore<Value>;
function async(...args: any[]) {
  return () => {};
}

function useStore<T>(store: Store<T>) {
  return {} as T;
}
