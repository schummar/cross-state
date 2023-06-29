[![npm badge](https://img.shields.io/npm/v/cross-state)](https://www.npmjs.com/package/cross-state)
[![bundlejs badge](https://deno.bundlejs.com/?badge&q=cross-state)](https://bundlejs.com/?q=cross-state)

State library for frontend and backend. With React bindings.

# Getting started

### Install

```
npm install cross-state
```

### Create a store

```ts
import { createStore } from 'cross-state';

export const store = createStore({
  counter: 0,
});
```
