export interface SmallState {
  count: number;
  label: string;
  enabled: boolean;
}

export interface BenchItem {
  id: string;
  name: string;
  value: number;
  active: boolean;
  tags: string[];
  meta: {
    createdAt: number;
    updatedAt: number;
    flags: Record<string, boolean>;
  };
}

export interface BigState {
  version: number;
  meta: {
    title: string;
    updatedAt: number;
  };
  order: string[];
  items: Record<string, BenchItem>;
}

export function createSmallState(seed = 0): SmallState {
  return {
    count: seed,
    label: `label-${seed}`,
    enabled: seed % 2 === 0,
  };
}

export function createItem(index: number): BenchItem {
  return {
    id: `item-${index}`,
    name: `Item number ${index}`,
    value: index * 3,
    active: index % 2 === 0,
    tags: [`tag-${index % 10}`, `group-${index % 4}`],
    meta: {
      createdAt: 1_700_000_000_000 + index * 1_000,
      updatedAt: 1_700_000_000_000 + index * 2_000,
      flags: { pinned: index % 5 === 0, archived: index % 7 === 0 },
    },
  };
}

export function createBigState(size: number): BigState {
  const order: string[] = [];
  const items: Record<string, BenchItem> = {};

  for (let index = 0; index < size; index++) {
    const item = createItem(index);
    order.push(item.id);
    items[item.id] = item;
  }

  return {
    version: 0,
    meta: { title: `state of ${size}`, updatedAt: 1_700_000_000_000 },
    order,
    items,
  };
}

/** Nested object of the given depth: `{ value, child: { value, child: ... } }`. */
export function createDeepState(depth: number): Record<string, any> {
  let node: Record<string, any> = { value: depth, leaf: true };

  for (let level = depth - 1; level >= 0; level--) {
    node = { value: level, child: node };
  }

  return node;
}

export function deepPathArray(depth: number): [string, ...string[]] {
  return ['child', ...Array.from({ length: depth - 1 }, () => 'child'), 'value'];
}

export function deepPathString(depth: number): string {
  return deepPathArray(depth).join('.');
}

/** Cycles through precomputed values so benchmarks measure the operation, not the fixture setup. */
export function cycler<T>(values: readonly T[]): () => T {
  let index = 0;

  return () => {
    const value = values[index % values.length]!;
    index++;
    return value;
  };
}

/** Keeps callbacks from being optimized away and gives a place to park observed values. */
export const sink: { value: unknown; count: number } = { value: undefined, count: 0 };

export function observe(value: unknown): void {
  sink.value = value;
  sink.count++;
}
