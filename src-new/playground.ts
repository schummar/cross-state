import { computed } from './core/computed';
import { async } from './core/async';
import { store } from './core/store';
import { once } from './core/once';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const AtomicStore = store('foo');
AtomicStore.subscribe((s) => console.log('simple', s));
AtomicStore.set((s) => s + '#');
AtomicStore.set('bar');

const mapStore = store(new Map<string, number>());
once(mapStore).then((v) => console.log('mapStore once', v));
once(mapStore, (m) => m.has('bar')).then((v) => console.log('mapStore once condition', v));
mapStore.subscribe((s) => console.log('map', s));
mapStore.with('foo', 42);
mapStore.with('bar', 43);
mapStore.without('foo');
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
  return [use(AtomicStore), use(mapStore).size, use(customActionsStore)].join(', ');
});

AtomicStore.set('xyz1');
console.log('-');

const nestedCalc = computed((use) => use(calculated) + '#');
nestedCalc.subscribe((s) => console.log('nested', s));

mapStore.with('x1', 1);

calculated.subscribe((s) => console.log('calculated', s));

AtomicStore.set('xyz');
mapStore.with('y', 1);

let c = 0;
const asyncStore = async(async () => {
  return c++;
});

asyncStore.subscribe((s) => console.log('async', s.value, s.isPending, s.isStale));
asyncStore.invalidate();
setTimeout(asyncStore.clear);

const [v, e, , , status] = asyncStore.get();
if (status === 'value') {
  console.log(v);
}

const pushStore = async<Record<string, number>>(async (get, register) => {
  register((set) => {
    let stopped = false;

    (async () => {
      for (let i = 0; !stopped; i++) {
        if (i % 4 === 0) set({ [`${get(AtomicStore)}_${i}`]: i });
        else set((items) => ({ ...items, [`${get(AtomicStore)}_${i}`]: i }));
        await sleep(1000);
      }
    })().catch((e) => {
      console.error('fail', e);
    });

    return () => {
      stopped = true;
    };
  });

  await sleep(2000);
  return { [`${get(AtomicStore)}_0`]: 42 };
});
const cancelPush = pushStore.subscribe((s) => console.log('push', s.value, s.isPending, s.isStale));
sleep(4000).then(pushStore.clear);
sleep(10000).then(cancelPush);

console.log('end');
