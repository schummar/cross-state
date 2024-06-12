[![npm badge](https://img.shields.io/npm/v/cross-state)](https://www.npmjs.com/package/cross-state)
[![bundlejs badge](https://deno.bundlejs.com/?badge&q=cross-state)](https://bundlejs.com/?q=cross-state)

State library for frontend and backend. With React bindings.

# Getting started

## Install

```
npm install cross-state
```

## The basics

cross-state provides a number of tools to manage state in your application.
The most important building blocks are: stores (`createStore`) for global state and caches (`createCache`) for e.g. wrapping api calls.
They can be used in any JavaScript environment and are not tied to any specific framework.
React bindings are provided and can be used to easily integrate cross-state in your ui.

### React bindings

You can use cross-state with React by importing the respective hooks - e.g. `useStore`.

```tsx
import { useStore } from 'cross-state/react';

function Counter() {
  const counter = useStore(store, (state) => state.counter); // with or without selector
  return <div>{counter}</div>;
}
```

Or you can register the react bindings with the Store and Cache prototypes.

```tsx
// Somewhere in your app setup
import 'cross-state/react/register';

function Counter() {
  const counter = store.useStore((state) => state.counter); // with or without selector
  return <div>{counter}</div>;
}
```

## Stores

### Create a store

The state can be any value, e.g. a number, an object or an array.

```ts
export const store = createStore({
  counter: 0,
});
```

### Get the current state

```ts
const state = store.get();
```

### Update the store

Pass in a new state or a function that updates the current state.

```ts
store.set((state) => ({
  counter: state.counter + 1,
}));
```

### Subscribe to changes

```ts
const cancel = store.subscribe((state) => {
  console.log('New state:', state);
});

// Later, to unsubscribe
cancel();
```

### Use the store in a React component

```tsx
function Counter() {
  const state = store.useStore(); // without selector - be careful with this, as it will rerender on every state change
  const counter1 = store.useStore((state) => state.counter); // with selector - will only rerender when the selected value changes
  const counter2 = store.useStore('counter'); // with string selector

  return (
    <div>
      <div>{state.counter}</div>
      <div>{counter1}</div>
      <div>{counter2}</div>
    </div>
  );
}
```

### Use the store in a React component with an update function

```tsx
function Counter() {
  const [value, setValue] = store.useProp('counter');

  return (
    <div>
      <div>{value}</div>
      <button onClick={() => setValue((value) => value + 1)}>Increment</button>
    </div>
  );
}
```

## Caches

### Create a cache

```ts
export const user = createCache(
  async (org: string, id: string) => {
    const response = await fetch(`https://api.example.com/${org}/${id}`);
    const user: User = response.json();
    return user;
  },
  {
    invalidateAfter: { minutes: 10 }, // automatically invalidate the cache after 10 minutes
  },
);
```

- `invalidateAfter: Duration | ((state: ValueState<T> | ErrorState) => Duration | null) | null;` - automatically invalidate the cache after a certain duration. You can also provide a function that returns a duration or null based on the current state of the cache:

```ts
export const cache = createCache([...],
  {
    invalidateAfter(({ status, value, error }) => {
      if (status === 'error') {
        return { minutes: 5 };
      }

      return value.expiresAt - Date.now();
    }),
    },
  },
);
```

### Use the cache

```ts
const data = await cache('users', '123');
```

### Use the cache in a React component

```tsx
function User({ org, id }: { org: string; id: string }) {
  const [user, error, isLoading] = user(org, id).useCache();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return <div>{user.name}</div>;
}
```

### Cache without parameters

When the cache does not have parameters or only optional parameters, you can use the cache without the parantheses.

```ts
const cache = createCache(async () => {
  return await fetch('https://api.example.com');
});

const data = await cache.useCache(); // equivalent to cache().useCache()

// or in a React component

const [data, error, isLoading] = cache.useCache();
```

### Cache with connection

_Experimental feature_

A cache can be used not only for fetching data, but also for keeping it up to date with a WebSocket connection or similar.

```ts
// Explicit type annotations for content and cache keys are required here because TypeScript cannot infer them when using a connection.
export const cache = createCache<Service, [serviceId: string]>(
  (serviceId) =>
    async ({ connect }) => {
      // optionally wait until the connection is established, before fetching the initial data
      // that ensures that no updates are missed
      await connect(({ updateIsConnected, updateValue, updateError, close }) => {
        const ws = new WebSocket(`wss://api.example.com/service/${serviceId}`);

        ws.addEventListener('open', () => updateIsConnected(true));
        ws.addEventListener('close', close);
        ws.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            updateValue(data);
          } catch (error) {
            updateError(error);
          }
        });

        return () => ws.close();
      });

      // fetch the initial data
      return await fetch(`https://api.example.com/service/${serviceId}`);
    },
  {
    // no cache invalidation here, because the cache is kept up to date by the connection
    invalidateOnWindowFocus: false,
  },
);
```
