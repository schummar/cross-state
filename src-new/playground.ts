import { async } from './asyncStore';
import { store } from './atomicStore';
import { computed } from './computed';

const simpleStore = store('foo');
simpleStore.subscribe((s) => console.log('simple', s));
simpleStore.set((s) => s + '#');
simpleStore.set('bar');

const mapStore = store(new Map<string, number>());
mapStore.subscribe((s) => console.log('map', s));
mapStore.mset('foo', 42);
mapStore.mset('bar', 43);
mapStore.delete('foo');
console.log(mapStore.get().has('bar'));
mapStore.clear();

const setStore = store(new Set<number>());
setStore.subscribe((x) => console.log('set', x));
setStore.add(42);

const arrStore = store([1, 2, 3]);
arrStore.subscribe((x) => console.log('arr', x));
arrStore.splice(1, 1, 42, 43);
arrStore.push(-1, -2);
arrStore.shift();

const customActionsStore = store(0, {
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

customActionsStore.subscribe((a) => console.log('customActions', a));
customActionsStore.inc();
customActionsStore.add(42);
customActionsStore.sub(10);
customActionsStore.set(3);

const calculated = computed((use) => {
  console.log('calc');
  return [use(simpleStore), use(mapStore).size, use(customActionsStore)].join(', ');
});

simpleStore.set('xyz1');
console.log('-');

const nestedCalc = computed((use) => use(calculated) + '#');
nestedCalc.subscribe((s) => console.log('nested', s));

mapStore.mset('x1', 1);

calculated.subscribe((s) => console.log('calculated', s));

simpleStore.set('xyz');
mapStore.mset('y', 1);

let c = 0;
const asyncStore = async(async () => {
  return c++;
});

asyncStore.subscribe((s) => console.log('async', s[2]));
asyncStore.invalidate();
setTimeout(asyncStore.clear);

const [v, e, , , status] = asyncStore.get();
if (status === 'value') {
  console.log(v);
}

console.log('end');
