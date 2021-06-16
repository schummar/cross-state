import test from 'ava';
import { Store } from '../src';
import { sleep } from '../src/helpers/misc';

test('getState', (t) => {
  const store = new Store({ foo: 'bar' });
  t.deepEqual(store.getState(), { foo: 'bar' });

  store.update((s) => {
    s.foo = 'baz';
  });
  t.deepEqual(store.getState(), { foo: 'baz' });

  store.set({ foo: 'bar' });
  t.deepEqual(store.getState(), { foo: 'bar' });
});

test('subscribe', async (t) => {
  const store = new Store({ foo: 0 });
  let value,
    count = 0;

  store.subscribe(
    (s) => s.foo * 2,
    (foo) => {
      value = foo;
      count++;
    }
  );
  t.is(value, undefined);
  t.is(count, 0);

  store.update((s) => {
    s.foo = 1;
  });
  store.update((s) => {
    s.foo = 2;
  });
  t.is(value, undefined);
  t.is(count, 0);

  await Promise.resolve();
  t.is(value, 4);
  t.is(count, 1);
});

test('subscribe additional properties', async (t) => {
  const store = new Store({ foo: 0 });
  t.plan(6);

  store.subscribe(
    (s) => s.foo,
    (foo, prev, state) => {
      t.is(prev, foo === 2 ? 1 : 0);
      t.deepEqual(state, { foo });
    },
    { runNow: true }
  );

  store.update((s) => {
    s.foo = 1;
  });

  await Promise.resolve();
  store.update((s) => {
    s.foo = 2;
  });
});

test('subscribe with run now', async (t) => {
  const store = new Store({ foo: 0 });
  let value,
    count = 0;

  store.subscribe(
    (s) => s.foo * 2,
    (foo) => {
      value = foo;
      count++;
    },
    { runNow: true }
  );
  t.is(value, 0);
  t.is(count, 1);

  store.update((s) => {
    s.foo = 1;
  });
  store.update((s) => {
    s.foo = 2;
  });
  t.is(value, 0);
  t.is(count, 1);

  await Promise.resolve();
  t.is(value, 4);
  t.is(count, 2);
});

test('subscribe throttled', async (t) => {
  const store = new Store({ foo: 0 });
  let value,
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
  await Promise.resolve();
  store.update((s) => {
    s.foo = 2;
  });
  await Promise.resolve();

  t.is(value, 2);
  t.is(count, 1);

  await sleep(125);
  t.is(value, 4);
  t.is(count, 2);
});

test('subscribe same value ignored', async (t) => {
  const store = new Store({ foo: 0 });
  t.plan(1);

  store.subscribe(
    (s) => s.foo,
    () => {
      t.pass();
    }
  );

  store.update((s) => {
    s.foo = 1;
  });
  await Promise.resolve();
  store.update((s) => {
    s.foo = 1;
  });
  await Promise.resolve();
});

test('cancel subscription', async (t) => {
  const store = new Store({ foo: 0 });
  let value,
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
  await Promise.resolve();
  t.is(value, 1);
  t.is(count, 1);

  cancel();

  store.update((s) => {
    s.foo = 2;
  });
  await Promise.resolve();
  t.is(value, 1);
  t.is(count, 1);
});

test('subscription error caught', async (t) => {
  let logged = '';
  const store = new Store({ foo: 0 }, { log: (s: string) => (logged = s) });

  store.subscribe(
    (s) => s.foo,
    () => {
      throw Error('test');
    }
  );

  t.notThrows(() =>
    store.update((s) => {
      s.foo = 1;
    })
  );

  await Promise.resolve();
  t.regex(logged, /^Failed to execute listener:/);
});

test('addReaction', async (t) => {
  const store = new Store({ foo: 0, bar: 0 });
  let count = 0;

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo * 2;
      count++;
    }
  );
  t.is(store.getState().bar, 0);
  t.is(count, 0);

  store.update((s) => {
    s.foo = 1;
  });
  t.is(store.getState().bar, 2);
  t.is(count, 1);
});

test('addReaction rerun', async (t) => {
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
  t.is(store.getState().baz, 3);
  t.is(count1, 2);
  t.is(count2, 1);
});

test('addReaction with runNow', async (t) => {
  const store = new Store({ foo: 1, bar: 0 });
  let count = 0;

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo * 2;
      count++;
    },
    { runNow: true }
  );
  t.is(store.getState().bar, 2);
  t.is(count, 1);

  store.update((s) => {
    s.foo = 2;
  });
  t.is(store.getState().bar, 4);
  t.is(count, 2);
});

test('addReaction cancel', async (t) => {
  const store = new Store({ foo: 1, bar: 0 });

  const cancel = store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo * 2;
    },
    { runNow: true }
  );

  store.update((s) => {
    s.foo = 2;
  });
  t.is(store.getState().bar, 4);

  cancel();

  store.update((s) => {
    s.foo = 3;
  });
  t.is(store.getState().bar, 4);
});

test('addReaction error caught', async (t) => {
  let logged = '';
  const store = new Store({ foo: 1, bar: 0 }, { log: (s: string) => (logged = s) });

  store.addReaction(
    (s) => s.foo,
    () => {
      throw Error('test');
    }
  );

  t.notThrows(() =>
    store.update((s) => {
      s.foo = 2;
    })
  );
  t.regex(logged, /^Failed to execute reaction:/);
});

test('addReaction throw on nested updates', async (t) => {
  const store = new Store({ foo: 0, bar: 0 });
  t.plan(1);

  store.addReaction(
    (s) => s.foo,
    (foo) => {
      t.throws(() =>
        store.update((s) => {
          s.bar = foo;
        })
      );
    }
  );

  store.update((s) => {
    s.foo = 1;
  });
});

test('addReaction with subscribe', async (t) => {
  const store = new Store({ foo: 0, bar: 0 });
  t.plan(1);

  store.subscribe(
    (s) => s.bar,
    (bar) => {
      t.is(bar, 1);
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

  await Promise.resolve();
});

test('addReaction with runNow subscribe', async (t) => {
  const store = new Store({ foo: 1, bar: 0 });
  t.plan(1);

  store.subscribe(
    (s) => s.bar,
    (bar) => {
      t.is(bar, 1);
    }
  );

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      s.bar = foo;
    },
    { runNow: true }
  );

  await Promise.resolve();
});

test('addReaction rerun with runNow', async (t) => {
  const store = new Store({ foo: 1 });
  t.plan(4);

  store.addReaction(
    (s) => s.foo,
    (foo, s) => {
      t.pass();
      if (foo % 2 === 1) s.foo++;
    },
    { runNow: true }
  );

  store.update((s) => {
    s.foo = 1;
  });

  await Promise.resolve();
});

test('subscribePatches', async (t) => {
  const store = new Store({ foo: 0 });
  let patches,
    count = 0;

  store.subscribePatches((p) => {
    patches = p;
    count++;
  });
  t.is(patches, undefined);
  t.is(count, 0);

  store.update((s) => {
    s.foo = 1;
  });
  t.is(patches, undefined);
  t.is(count, 0);

  await Promise.resolve();
  t.deepEqual(patches, [{ op: 'replace', path: ['foo'], value: 1 }]);
  t.is(count, 1);
});

test('subscribePatches cancel', async (t) => {
  const store = new Store({ foo: 0 });
  let count = 0;

  const cancel = store.subscribePatches(() => {
    count++;
  });

  store.update((s) => {
    s.foo = 1;
  });
  await Promise.resolve();
  t.is(count, 1);

  cancel();

  store.update((s) => {
    s.foo = 2;
  });
  await Promise.resolve();
  t.is(count, 1);
});

test('subscribePatches error caught', async (t) => {
  let logged = '';
  const store = new Store({ foo: 0 }, { log: (s: string) => (logged = s) });

  store.subscribePatches(() => {
    throw Error('test');
  });

  t.notThrows(() =>
    store.update((s) => {
      s.foo = 1;
    })
  );
  await Promise.resolve();
  t.regex(logged, /^Failed to execute patch listener:/);
});

test('apply patches', async (t) => {
  const store = new Store({ foo: 0 });

  store.applyPatches([{ op: 'replace', path: ['foo'], value: 1 }]);
  t.is(store.getState().foo, 1);
});
