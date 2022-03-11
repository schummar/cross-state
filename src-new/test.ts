///////////////////////////////////////////////////////////
// Base types
///////////////////////////////////////////////////////////

type Store<T> = {
  subscribe(listener: (t: T) => void): () => void;
  get(): T;
};

export type AtomicStore<T> = Store<T> & {
  set(t: T): void;
};

type AsyncStore<T> = Store<[value: T | undefined, isLoading: boolean, error?: unknown]> & {
  run(): Promise<T>;
};

///////////////////////////////////////////////////////////
// store
///////////////////////////////////////////////////////////

function store<T, Actions extends Record<string, (...args: any[]) => any>>(
  value: T,
  actions?: Actions & ThisType<AtomicStore<T> & Actions>
): AtomicStore<T> & Omit<Actions & ThisType<AtomicStore<T> & Actions>, keyof AtomicStore<T>> {
  const listeners = new Set<(t: T) => void>();

  const store: AtomicStore<T> = {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    get() {
      return value;
    },

    set(newValue) {
      value = newValue;
      for (const listener of listeners) {
        listener(newValue);
      }
    },
  };

  const boundActions = Object.fromEntries(
    Object.entries(actions ?? {})
      .filter(([key, fn]) => !['subscribe', 'get', 'set'].includes(key))
      .map(([name, fn]) => [name, fn.bind(store, store)])
  ) as Actions;

  return Object.assign(store, boundActions);
}

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

const mapActions = {
  mset<K, V>(this: AtomicStore<Map<K, V>>, key: K, value: V) {
    const newMap = new Map(this.get());
    newMap.set(key, value);
    this.set(newMap);
  },

  delete<K, V>(this: AtomicStore<Map<K, V>>, key: K) {
    const newMap = new Map(this.get());
    newMap.delete(key);
    this.set(newMap);
  },

  hash<K, V>(this: AtomicStore<Map<K, V>>, key: K) {
    return this.get().has(key);
  },
};

const a = store(0, {
  inc() {
    this.set(this.get() + 1);
  },

  add(x: number) {
    this.set(this.get() + x);
  },

  sub(x: number) {
    this.add(-x);
  },
});

a.subscribe((a) => console.log('sub', a));
console.log(a.get());

a.inc();
a.add(42);
a.sub(10);
a.set(3);

const mapStore = store(new Map<string, number>(), mapActions);
mapStore.subscribe((s) => console.log('mapStore', s));
mapStore.mset('foo', 42);
mapStore.mset('bar', 43);
mapStore.delete('foo');
console.log(mapStore.hash('bar'));

const b = store('b');
const c = store(true);
const double = calc(a, (a) => a * 2);
const summmary = calc([a, b, c], (a, b, c) => [a, b, c].join(', '));

const allItems = async(c, async () => [{ id: 1, name: 'name' }])();
const fetchItemById = async(c, async (itemId: string, c) => (c ? { itemId } : null), {});

const cool = calc([allItems, c], ([value], c) => (value && c ? value.length : undefined));

// const item = asyncX((itemId: string) => async(a, async (a) => itemId + a));

// function Row() {
//   const sum = useStore(summmary);
//   const [items] = useStore(allItems);
//   const [item] = useStore(fetchItemById('foo'));

//   console.log('done');

//   return null;
// }
// Row();
