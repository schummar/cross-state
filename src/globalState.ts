import { Store } from './state/store';
import { Cache } from './state/cache';

export default new Store({
  counter: 1,
  counter2: 1,
});

export const cache1 = new Cache<{ id: string; foo: string }, string>((x) => x.id);
export const action1 = cache1.createAction(async (bar: string) => {
  await new Promise((r) => setTimeout(r, 1000));
  return [{ id: 'a', foo: bar + 'baz' }];
});

window.cache1 = cache1;
