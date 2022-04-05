import { Patch } from 'immer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Store } from '../src';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.resetAllMocks();
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

describe('subscribe', () => {
  test('simple subscribe', async () => {
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
    expect(value).toBe(4);
    expect(count).toBe(3);
  });

  test('subscribe with string selector', async () => {
    const store = new Store({ foo: 0 });
    let value: number | undefined,
      count = 0;

    store.subscribe('foo', (foo) => {
      value = foo;
      count++;
    });
    expect(value).toBe(0);
    expect(count).toBe(1);

    store.update((s) => {
      s.foo = 1;
    });
    store.update((s) => {
      s.foo = 2;
    });
    expect(value).toBe(2);
    expect(count).toBe(3);
  });

  test('subscribe additional properties', async () => {
    const store = new Store({ foo: 0 });
    let prev, state;

    store.subscribe(
      (s) => s.foo,
      (_foo, _prev, _state) => {
        prev = _prev;
        state = _state;
      }
    );
    expect(prev).toBe(0);
    expect(state).toEqual({ foo: 0 });

    store.update((s) => {
      s.foo = 1;
    });
    store.update((s) => {
      s.foo = 2;
    });
    expect(prev).toBe(1);
    expect(state).toEqual({ foo: 2 });
  });

  test('subscribe with runNow=false', async () => {
    const store = new Store({ foo: 0 });
    let value: number | undefined,
      count = 0;

    store.subscribe(
      (s) => s.foo * 2,
      (foo) => {
        value = foo;
        count++;
      },
      { runNow: false }
    );
    expect(value).toBe(undefined);
    expect(count).toBe(0);

    store.update((s) => {
      s.foo = 1;
    });
    store.update((s) => {
      s.foo = 2;
    });
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
    vi.advanceTimersByTime(50);
    store.update((s) => {
      s.foo = 2;
    });
    vi.advanceTimersByTime(49);

    expect(value).toBe(2);
    expect(count).toBe(2);

    vi.advanceTimersByTime(1);
    expect(value).toBe(4);
    expect(count).toBe(3);
  });

  test('subscribe same value ignored', async () => {
    const store = new Store({ foo: 0 });
    let count = 0;

    store.subscribe(
      (s) => s.foo,
      () => {
        count++;
      }
    );

    store.update((s) => {
      s.foo = 1;
    });
    store.update((s) => {
      s.foo = 1;
    });
    expect(count).toBe(2);
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
    vi.runAllTimers();
    expect(value).toBe(1);
    expect(count).toBe(2);

    cancel();

    store.update((s) => {
      s.foo = 2;
    });
    vi.runAllTimers();
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

    vi.runAllTimers();
    expect(logged).toMatch(/^Failed to execute listener:/);
  });

  test('nested updates', async () => {
    const store = new Store({ foo: 0 });

    store.subscribe(
      (s) => s.foo,
      (foo) => {
        if (foo === 1) return;

        store.update((s) => {
          s.foo = 1;
        });
      }
    );

    expect(store.getState().foo).toBe(1);
  });

  test('subscription without selector', async () => {
    const store = new Store(0);
    let value;
    store.subscribe((v) => (value = v), { runNow: false });

    expect(value).toBe(undefined);
    store.set(1);
    expect(value).toBe(1);
  });
});

describe('addReaction', () => {
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

  test('addReaction with string selector', async () => {
    const store = new Store({ foo: 0, bar: 0 });
    let count = 0;

    store.addReaction('foo', (foo, s) => {
      s.bar = foo * 2;
      count++;
    });
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

  test('addReaction with runNow', async () => {
    const store = new Store({ foo: 1, bar: 0 });
    let count = 0;

    store.addReaction(
      (s) => s.foo,
      (foo, s) => {
        s.bar = foo * 2;
        count++;
      }
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
      }
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

  test('addReaction nested updates', async () => {
    const store = new Store({ foo: 0, bar: 0 });
    let errorCount = 0;

    store.addReaction(
      (s) => s.foo,
      (foo) => {
        try {
          store.update((s) => {
            s.bar = foo;
          });
        } catch {
          errorCount++;
        }
      }
    );

    expect(errorCount).toBe(1);
  });

  test('addReaction without selector', async () => {
    const store = new Store(0);

    store.addReaction(
      (v) => {
        if (v < 2) return v + 1;
        return undefined;
      },
      { runNow: false }
    );

    expect(store.getState()).toBe(0);
    store.set(1);
    expect(store.getState()).toBe(2);
  });

  test('addReaction with subscribe', async () => {
    const store = new Store({ foo: 0, bar: 0 });
    const calls = new Array<string>();

    store.subscribe(
      (s) => s.bar,
      (bar) => {
        calls.push(`s:${bar}`);
      }
    );

    store.addReaction(
      (s) => s.foo,
      (foo, s) => {
        calls.push(`r:${foo}`);
        s.bar = foo;
      }
    );

    store.update((s) => {
      s.foo = 1;
    });
    expect(calls).toEqual(['s:0', 'r:0', 'r:1', 's:1']);
  });

  test('addReaction with runNow=false subscribe', async () => {
    const store = new Store({ foo: 0, bar: 0 });
    const calls = new Array<string>();

    store.subscribe(
      (s) => s.bar,
      (bar) => {
        calls.push(`s:${bar}`);
      }
    );

    store.addReaction(
      (s) => s.foo,
      (foo, s) => {
        calls.push(`r:${foo}`);
        s.bar = foo;
      },
      { runNow: false }
    );

    store.update((s) => {
      s.foo = 1;
    });
    expect(calls).toEqual(['s:0', 'r:1', 's:1']);
  });

  test('addReaction rerun', async () => {
    const store = new Store({ foo: 1 });
    const calls = new Array<string>();

    store.addReaction(
      (s) => s.foo,
      (foo, s) => {
        calls.push(`r:${foo}`);
        if (foo % 2 === 1) s.foo++;
      }
    );

    store.update((s) => {
      s.foo = 1;
    });
    expect(calls).toEqual(['r:1', 'r:2', 'r:1', 'r:2']);
    expect(store.getState().foo).toBe(2);
  });
});

describe('subscribePatches', () => {
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
    vi.runAllTimers();
    expect(count).toBe(1);

    cancel();

    store.update((s) => {
      s.foo = 2;
    });
    vi.runAllTimers();
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
    vi.runAllTimers();
    expect(logged).toMatch(/^Failed to execute patch listener:/);
  });
});

test('apply patches', async () => {
  const store = new Store({ foo: 0 });

  store.applyPatches([{ op: 'replace', path: ['foo'], value: 1 }]);
  expect(store.getState().foo).toBe(1);
});

test('update by returning new value', async () => {
  const store = new Store({ foo: 0 });

  store.update((state) => ({ foo: state.foo + 1 }));
  expect(store.getState().foo).toBe(1);
});

test('batchUpdates', async () => {
  const store = new Store(0);

  let count = 0;
  store.subscribe(() => count++, { runNow: false });

  store.batchUpdates(() => {
    store.update(() => 1);
    store.update(() => 2);
  });

  expect(count).toBe(1);
});
