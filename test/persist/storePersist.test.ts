import test from 'ava';
import localforage from 'localforage';
import nodePersist from 'node-persist';
import { Store, StorePersist } from '../../src';
import { sleep } from '../../src/helpers/misc';

type State = {
  wellKnownObject: { wellKnownProp: string };
  simpleDict: { [id: string]: string };
  complexDict: { [id: string]: { complexDictProps: string } };
  simpleArray: string[];
  complexArray: { complexArrayProp: string }[];
  nested: { [id: string]: { [id: string]: { nestedProp: string } } };
  notPersisted: { notPersitedProps: string };
};
const initalState: State = {
  wellKnownObject: { wellKnownProp: 'a' },
  simpleDict: {},
  complexDict: {},
  simpleArray: [],
  complexArray: [],
  nested: {},
  notPersisted: { notPersitedProps: 'a' },
};

class MockStorage {
  constructor(public readonly items: { [key: string]: string } = {}) {}

  getItem(key: string) {
    return this.items[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.items[key] = value;
  }
  removeItem(key: string) {
    delete this.items[key];
  }
  keys() {
    return Object.keys(this.items);
  }
}

class MockStorageWithoutKeys {
  constructor(public readonly items: { [key: string]: string } = {}) {}

  getItem(key: string) {
    return this.items[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.items[key] = value;
  }
  removeItem(key: string) {
    delete this.items[key];
  }
  length() {
    return Object.keys(this.items).length;
  }
  key(i: number) {
    return Object.keys(this.items)[i] ?? null;
  }
}

test('save', async (t) => {
  const store = new Store(initalState);
  const storage = new MockStorage();
  const persist = new StorePersist(store, storage, {
    paths: [
      'wellKnownObject',
      'simpleDict.*',
      'complexDict.*',
      'simpleArray.*',
      'complexArray.*',
      'nested.*',
      'nested.*.*',
      'nested.*.*.*',
      'nested.*.*.nestedProp',
    ],
  });

  await persist.initialization;

  store.update((state) => {
    state.wellKnownObject.wellKnownProp = 'b';
    state.simpleDict.id1 = 'value1';
    state.complexDict.id2 = { complexDictProps: 'value2' };
    state.simpleArray.push('value3');
    state.complexArray.push({ complexArrayProp: 'value4' });
    state.nested.id3 = { id4: { nestedProp: 'value5' } };
    state.notPersisted.notPersitedProps = 'value6';
  });

  await Promise.resolve();

  t.deepEqual(storage.items, {
    wellKnownObject: '{"wellKnownProp":"b"}',
    'simpleDict.id1': '"value1"',
    'complexDict.id2': '{"complexDictProps":"value2"}',
    'simpleArray.0': '"value3"',
    'complexArray.0': '{"complexArrayProp":"value4"}',
    'nested.id3': '{}',
    'nested.id3.id4': '{}',
    'nested.id3.id4.nestedProp': '"value5"',
  });
});

test('save throttled', async (t) => {
  const store = new Store(initalState);
  const storage = new MockStorage();
  const persist = new StorePersist(store, storage, {
    paths: ['wellKnownObject', { path: 'complexDict.*', throttleMs: 100 }],
  });

  await persist.initialization;

  store.update((state) => {
    state.wellKnownObject.wellKnownProp = 'b';
    state.complexDict.id2 = { complexDictProps: 'value2' };
  });

  await Promise.resolve();

  t.deepEqual(storage.items, {
    wellKnownObject: '{"wellKnownProp":"b"}',
  });

  await sleep(150);

  t.deepEqual(storage.items, {
    wellKnownObject: '{"wellKnownProp":"b"}',
    'complexDict.id2': '{"complexDictProps":"value2"}',
  });
});

test('load', async (t) => {
  const store = new Store(initalState);
  const storage = new MockStorage({
    wellKnownObject: '{"wellKnownProp":"b"}',
    'simpleDict.id1': '"value1"',
    'complexDict.id2': '{"complexDictProps":"value2"}',
    'simpleArray.0': '"value3"',
    'complexArray.0': '{"complexArrayProp":"value4"}',
    'nested.id3': '{}',
    'nested.id3.id4': '{}',
    'nested.id3.id4.nestedProp': '"value5"',
  });
  const persist = new StorePersist(store, storage);

  await persist.initialization;

  t.deepEqual(store.getState(), {
    wellKnownObject: { wellKnownProp: 'b' },
    simpleDict: { id1: 'value1' },
    complexDict: { id2: { complexDictProps: 'value2' } },
    simpleArray: ['value3'],
    complexArray: [{ complexArrayProp: 'value4' }],
    nested: { id3: { id4: { nestedProp: 'value5' } } },
    notPersisted: { notPersitedProps: 'a' },
  });
});

test('load alternative storage', async (t) => {
  const store = new Store(initalState);
  const storage = new MockStorageWithoutKeys({
    wellKnownObject: '{"wellKnownProp":"b"}',
    'simpleDict.id1': '"value1"',
    'complexDict.id2': '{"complexDictProps":"value2"}',
    'simpleArray.0': '"value3"',
    'complexArray.0': '{"complexArrayProp":"value4"}',
    'nested.id3': '{}',
    'nested.id3.id4': '{}',
    'nested.id3.id4.nestedProp': '"value5"',
  });
  const persist = new StorePersist(store, storage);

  await persist.initialization;

  t.deepEqual(store.getState(), {
    wellKnownObject: { wellKnownProp: 'b' },
    simpleDict: { id1: 'value1' },
    complexDict: { id2: { complexDictProps: 'value2' } },
    simpleArray: ['value3'],
    complexArray: [{ complexArrayProp: 'value4' }],
    nested: { id3: { id4: { nestedProp: 'value5' } } },
    notPersisted: { notPersitedProps: 'a' },
  });
});

test('compatible with localStorage', async (t) => {
  const store = new Store(initalState);
  new StorePersist(store, localStorage);
  t.pass();
});

test('compatible with localforage', async (t) => {
  const store = new Store(initalState);
  new StorePersist(store, localforage);
  t.pass();
});

test('compatible with node-persist', async (t) => {
  const store = new Store(initalState);
  new StorePersist(store, nodePersist);
  t.pass();
});

test('stop', async (t) => {
  const store = new Store(initalState);
  const storage = new MockStorage();
  const persist = new StorePersist(store, storage, {
    paths: ['wellKnownObject'],
  });

  await persist.initialization;

  store.update((state) => {
    state.wellKnownObject.wellKnownProp = 'b';
  });

  await Promise.resolve();

  t.deepEqual(storage.items, {
    wellKnownObject: '{"wellKnownProp":"b"}',
  });

  persist.stop();

  store.update((state) => {
    state.wellKnownObject.wellKnownProp = 'c';
  });

  await Promise.resolve();

  t.deepEqual(storage.items, {
    wellKnownObject: '{"wellKnownProp":"b"}',
  });
});

test('undefined', async (t) => {
  const store = new Store<{ foo?: string }>({ foo: '' as string | undefined });
  const storage = new MockStorage();
  const persist = new StorePersist(store, storage, { paths: ['foo'] });

  await persist.initialization;

  store.update((state) => {
    state.foo = undefined;
  });

  await Promise.resolve();

  const newStore = new Store<{ foo?: string }>({});
  const newPersist = new StorePersist(newStore, storage, { paths: ['foo'] });
  await newPersist.initialization;

  t.is(newStore.getState().foo, undefined);
});

test('serialized map/set/date', async (t) => {
  const store = new Store<any>({});
  const storage = new MockStorage();
  const persist = new StorePersist(store, storage);
  await persist.initialization;

  store.set({ a: new Map([['a', 1]]), b: new Set('b'), c: new Date(0) });
  await Promise.resolve();

  t.deepEqual(storage.items, { '': '{"a":{"__map":[["a",1]]},"b":{"__set":["b"]},"c":{"__date":"1970-01-01T00:00:00.000Z"}}' });

  const newStore = new Store<any>({});
  const newPersist = new StorePersist(newStore, storage);
  await newPersist.initialization;

  t.assert(newStore.getState().a instanceof Map);
  t.assert(newStore.getState().b instanceof Set);
  t.assert(newStore.getState().c instanceof Date);
});
