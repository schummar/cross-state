[![npm badge](https://badgen.net/npm/v/schummar-state)](https://www.npmjs.com/package/schummar-state)
[![bundlephobia badge](https://badgen.net/bundlephobia/minzip/schummar-state)](https://bundlephobia.com/result?p=schummar-state)

Lighweight React hooks based state library.
Heavily inspired by [pullstate](https://github.com/lostpebble/pullstate)

# Getting started

### Install

```
npm install schummar-state
```

### Create a store

```ts
import { Store } from 'schummar-state';

export const store = new Store({
  counter: 0,
});
```

You can easily use multiple stores in parallel.

### Use store in a component

```tsx
import store from './store.ts';

export function App() {
  const counter = store.useState((state) => state.counter);

  return (
    <div>
      <div>Counter: {counter}</div>
    </div>
  );
}
```

### Update a store

```tsx
import store from './store.ts';

export function App() {
  const counter = store.useState((state) => state.counter);

  const increment = () =>
    store.update((state) => {
      state.counter++;
    });

  return (
    <div>
      <div>Counter: {counter}</div>
      <button onClick={increment}>Increment</button>
    </div>
  );
}
```
