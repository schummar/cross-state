import test from 'ava';
import { Store, Persist } from '../src';
import { sleep } from '../src/misc';
import localforage from 'localforage';
import nodePersist from 'node-persist';

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

test('save', async (t) => {
  const store = new Store(initalState);
  const storage = new MockStorage();
  const persist = new Persist(store, storage, {
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
  const persist = new Persist(store, storage, {
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
  const persist = new Persist(store, storage);

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
  new Persist(store, localStorage);
  t.pass();
});

test('compatible with localforage', async (t) => {
  const store = new Store(initalState);
  new Persist(store, localforage);
  t.pass();
});

test('compatible with node-persist', async (t) => {
  const store = new Store(initalState);
  new Persist(store, nodePersist);
  t.pass();
});
