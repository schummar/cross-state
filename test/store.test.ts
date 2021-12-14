import { Patch } from 'immer';
import { Store } from '../src';

jest.useFakeTimers();

afterEach(() => {
  jest.runAllTimers();
});

test('getState', async () => {
  const store = new Store({ foo: 'bar' });
  expect(store.getState()).toEqual({ foo: 'bar' });

  store.update((s) => {
    s.foo = 'baz';
  });
  expect(store.getState()).toEqual({ foo: 'baz' });

  store.set({ foo: 'bar' });
  expect(store.getState()).toEqual({ foo: 'bar' });
});

test('subscribe', async () => {
  const store = new Store({ foo: 0 });
  let value: number | undefined,
    count = 0;

  store.subscribe(
    (s) => s.foo * 2,
    (foo) => {
      value = foo;
      count++;
    }
  );
  expect(value).toBe(0);
  expect(count).toBe(1);

  store.update((s) => {
    s.foo = 1;
  });
  store.update((s) => {
    s.foo = 2;
  });
  expect(value).toBe(0);
  expect(count).toBe(1);

  jest.runAllTimers();
  expect(value).toBe(4);
  expect(count).toBe(2);
});

test('subscribe additional properties', async () => {
  const store = new Store({ foo: 0 });
  expect.assertions(6);

  store.subscribe(
    (s) => s.foo,
    (foo, prev, state) => {
      expect(prev).toBe(foo === 2 ? 1 : 0);
      expect(state).toEqual({ foo });
    },
    { callbackNow: true }
  );

  store.update((s) => {
    s.foo = 1;
  });

  jest.runAllTimers();
  store.update((s) => {
    s.foo = 2;
  });
});

test('subscribe with run now', async () => {
  const store = new Store({ foo: 0 });
  let value: number | undefined,
    count = 0;

  store.subscribe(
    (s) => s.foo * 2,
    (foo) => {
      value = foo;
      count++;
    },
    { callbackNow: true }
  );
  expect(value).toBe(0);
  expect(count).toBe(1);

  store.update((s) => {
    s.foo = 1;
  });
  store.update((s) => {
    s.foo = 2;
  });
  expect(value).toBe(0);
  expect(count).toBe(1);

  jest.runAllTimers();
  expect(value).toBe(4);
  expect(count).toBe(2);
});

test('subscribe throttled', async () => {
  const store = new Store({ foo: 0 });
  let value: number | undefined,
    count = 0;

  store.subscribe(
    (s) => s.foo * 2,
    (foo) => {
      value = foo;
      count++;
    },
    { throttle: 100 }
  );

  store.update((s) => {
    s.foo = 1;
  });
  jest.advanceTimersByTime(50);
  store.update((s) => {
    s.foo = 2;
  });
  jest.advanceTimersByTime(49);

  expect(value).toBe(2);
  expect(count).toBe(2);

  jest.advanceTimersByTime(1);
  expect(value).toBe(4);
  expect(count).toBe(3);
});

test('subscribe same value ignored', async () => {
  const store = new Store({ foo: 0 });
  expect.assertions(2);

  store.subscribe(
    (s) => s.foo,
    () => {
      expect(true).toBe(true);
    }
  );

  store.update((s) => {
    s.foo = 1;
  });
  jest.runAllTimers();
  store.update((s) => {
    s.foo = 1;
  });
  jest.runAllTimers();
});

test('cancel subscription', async () => {
  const store = new Store({ foo: 0 });
  let value: number | undefined,
    count = 0;

  const cancel = store.subscribe(
    (s) => s.foo,
    (foo) => {
      value = foo;
      count++;
    }
  );

  store.update((s) => {
    s.foo = 1;
  });
  jest.runAllTimers();
  expect(value).toBe(1);
  expect(count).toBe(2);

  cancel();

  store.update((s) => {
    s.foo = 2;
  });
  jest.runAllTimers();
  expect(value).toBe(1);
  expect(count).toBe(2);
});

test('subscription error caught', async () => {
  let logged = '';
  const store = new Store({ foo: 0 }, { log: (s: string) => (logged = s) });

  store.subscribe(
    (s) => s.foo,
    () => {
      throw Error('test');
    }
  );

  expect(() =>
    store.update((s) => {
      s.foo = 1;
    })
  ).not.toThrow();

  jest.runAllTimers();
  expect(logged).toMatch(/^Failed to execute listener:/);
});

test('addReaction', async () => {
  const store = new Store({ foo: 0, bar: 0 });
  let count = 0;

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo * 2;
      count++;
    }
  );
  expect(store.getState().bar).toBe(0);
  expect(count).toBe(1);

  store.update((s) => {
    s.foo = 1;
  });
  expect(store.getState().bar).toBe(2);
  expect(count).toBe(2);
});

test('addReaction rerun', async () => {
  const store = new Store({ foo: 0, bar: 0, baz: 0 });
  let count1 = 0,
    count2 = 0;

  store.addReaction(
    (s) => [s.foo, s.bar] as const,
    ([foo, bar], s) => {
      s.baz = foo + bar;
      count1++;
    }
  );

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo * 2;
      count2++;
    }
  );

  store.update((s) => {
    s.foo = 1;
    s.bar = 1;
  });
  expect(store.getState().baz).toBe(3);
  expect(count1).toBe(3);
  expect(count2).toBe(2);
});

test('addReaction with callbackNow', async () => {
  const store = new Store({ foo: 1, bar: 0 });
  let count = 0;

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo * 2;
      count++;
    },
    { callbackNow: true }
  );
  expect(store.getState().bar).toBe(2);
  expect(count).toBe(1);

  store.update((s) => {
    s.foo = 2;
  });
  expect(store.getState().bar).toBe(4);
  expect(count).toBe(2);
});

test('addReaction cancel', async () => {
  const store = new Store({ foo: 1, bar: 0 });

  const cancel = store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo * 2;
    },
    { callbackNow: true }
  );

  store.update((s) => {
    s.foo = 2;
  });
  expect(store.getState().bar).toBe(4);

  cancel();

  store.update((s) => {
    s.foo = 3;
  });
  expect(store.getState().bar).toBe(4);
});

test('addReaction error caught', async () => {
  let logged = '';
  const store = new Store({ foo: 1, bar: 0 }, { log: (s: string) => (logged = s) });

  store.addReaction(
    (s) => s.foo,
    () => {
      throw Error('test');
    }
  );

  expect(() =>
    store.update((s) => {
      s.foo = 2;
    })
  ).not.toThrow();
  expect(logged).toMatch(/^Failed to execute reaction:/);
});

test('addReaction throw on nested updates', async () => {
  const store = new Store({ foo: 0, bar: 0 });
  expect.assertions(1);

  store.addReaction(
    (s) => s.foo,
    (foo) => {
      expect(() =>
        store.update((s) => {
          s.bar = foo;
        })
      ).toThrow();
    }
  );
});

test('addReaction with subscribe', async () => {
  const store = new Store({ foo: 0, bar: 0 });
  expect.assertions(2);

  let count = 0;
  store.subscribe(
    (s) => s.bar,
    (bar) => {
      expect(bar).toBe(count++);
    }
  );

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo;
    }
  );

  store.update((s) => {
    s.foo = 1;
  });

  jest.runAllTimers();
});

test('addReaction with callbackNow=false subscribe', async () => {
  const store = new Store({ foo: 1, bar: 0 });
  expect.assertions(1);

  store.subscribe(
    (s) => s.bar,
    (bar) => {
      expect(bar).toBe(0);
    }
  );

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo;
    },
    { callbackNow: false }
  );

  jest.runAllTimers();
});

test('addReaction rerun with callbackNow', async () => {
  const store = new Store({ foo: 1 });
  expect.assertions(4);

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      expect(true).toBeTruthy();
      if (foo % 2 === 1) s.foo++;
    },
    { callbackNow: true }
  );

  store.update((s) => {
    s.foo = 1;
  });

  jest.runAllTimers();
});

test('subscribePatches', async () => {
  const store = new Store({ foo: 0 });
  let patches: Patch[] | undefined,
    count = 0;

  store.subscribePatches((p) => {
    patches = p;
    count++;
  });
  expect(patches).toBe(undefined);
  expect(count).toBe(0);

  store.update((s) => {
    s.foo = 1;
  });
  expect(patches).toBe(undefined);
  expect(count).toBe(0);

  jest.runAllTimers();
  expect(patches).toEqual([{ op: 'replace', path: ['foo'], value: 1 }]);
  expect(count).toBe(1);
});

test('subscribePatches cancel', async () => {
  const store = new Store({ foo: 0 });
  let count = 0;

  const cancel = store.subscribePatches(() => {
    count++;
  });

  store.update((s) => {
    s.foo = 1;
  });
  jest.runAllTimers();
  expect(count).toBe(1);

  cancel();

  store.update((s) => {
    s.foo = 2;
  });
  jest.runAllTimers();
  expect(count).toBe(1);
});

test('subscribePatches error caught', async () => {
  let logged = '';
  const store = new Store({ foo: 0 }, { log: (s: string) => (logged = s) });

  store.subscribePatches(() => {
    throw Error('test');
  });

  expect(() =>
    store.update((s) => {
      s.foo = 1;
    })
  ).not.toThrow();
  jest.runAllTimers();
  expect(logged).toMatch(/^Failed to execute patch listener:/);
});

test('apply patches', async () => {
  const store = new Store({ foo: 0 });

  store.applyPatches([{ op: 'replace', path: ['foo'], value: 1 }]);
  expect(store.getState().foo).toBe(1);
});

test('update during subscribe callback', async () => {
  const store = new Store({ foo: 0 });

  expect.assertions(4);

  store.subscribePatches((patches) => {
    expect(patches.length).toBe(1);
  });

  store.subscribe(
    (state) => state.foo,
    (foo) => {
      expect(true).toBeTruthy();
      if (foo === 1) {
        store.update((state) => {
          state.foo++;
        });
      }
    },
    { callbackNow: false }
  );

  store.update((state) => {
    state.foo++;
  });
});

test('update by returning new value', async () => {
  const store = new Store({ foo: 0 });

  expect.assertions(1);
  store.subscribe(
    (s) => s.foo,
    (foo) => expect(foo).toBe(1),
    { callbackNow: false }
  );

  store.update((state) => ({ foo: state.foo + 1 }));
});
