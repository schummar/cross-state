import { benchGroup } from './_baseline.ts';
import { createBigState, createItem, observe } from './_fixtures.ts';
import { trackingProxy } from '@lib/trackingProxy';
import { test, describe } from 'vite-plus/test';

const BIG_SIZE = 1000;

const bigBase = createBigState(BIG_SIZE);
const item = createItem(1);
describe('trackingProxy', () => {
  test('create and read', async (ctx) => {
    await benchGroup(ctx, {
      '2 properties of a nested item': () => {
        const [proxy, equals] = trackingProxy(item);
        observe(proxy.name);
        observe(proxy.meta.flags['pinned']);
        observe(equals(item));
      },
      [`1 property of big state (${BIG_SIZE} items)`]: () => {
        const [proxy, equals] = trackingProxy(bigBase);
        observe(proxy.meta.updatedAt);
        observe(equals(bigBase));
      },
      [`all keys of big state (${BIG_SIZE} items)`]: () => {
        const [proxy, equals] = trackingProxy(bigBase);
        observe(Object.keys(proxy.items).length);
        observe(equals(bigBase));
      },
    });
  });
});
