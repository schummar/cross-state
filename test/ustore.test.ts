import { expect, test } from 'vitest';
import { store } from '../src/core/store';
import { storeSet } from '../src/core/storeSet';

test('ustore', async () => {
  const s1 = store({ foo: 'bar' });
  expect(s1.get()).toEqual({ foo: 'bar' });

  const s1_2 = store(() => {
    return 1;
  });

  const s2 = store(({ use }) => {
    return { ...use(s1), baz: 42, x: use(s1_2) };
  });
  expect(s2.get()).toEqual({ foo: 'bar', baz: 42, x: 1 });

  const s3 = store(async ({ use }) => {
    return use(s2).baz + use(s2).x + 1;
  });
  s3.subscribe(() => undefined);

  expect(s3.get().state).toBe('pending');
  expect(await s3.get()).toBe(44);

  expect(s2.isActive).toBe(true);
  expect(s1_2.isActive).toBe(true);
  expect(s1.isActive).toBe(true);

  const result = s3.get();
  expect(result.state === 'resolved' && result.value).toBe(44);

  const f1 = storeSet(async function (s: string) {
    console.log('calc f1', s);
    return `hello ${s} (${this.use(s1).foo})`;
  });
  expect(await f1('marco').get()).toBe('hello marco (bar)');
  expect(await f1('marco').get()).toBe('hello marco (bar)');
  s1.update({ foo: 'bar1' });
  expect(await f1('sonja').get()).toBe('hello sonja (bar1)');
});

test('actions', () => {
  const s1 = store(new Map<string, string>([['a', 'b']]), {});

  expect(s1.get().size).toBe(1);
  s1.clear();
  expect(s1.get().size).toBe(0);

  const s2 = store(1);
  expect((s2 as any).clear).toBe(undefined);
});

test('update', () => {
  const s = store(async () => ({ x: 1 }));

  s.update({ x: 2 });
});
