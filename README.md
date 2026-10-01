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

## Forms

_React only._ A form keeps a draft of an object, tracks changes against an original, validates and renders inputs bound to paths of the draft.

### Create a form

```tsx
import { createForm } from 'cross-state/react';

interface User {
  name: string;
  email: string;
  tags: string[];
}

export const userForm = createForm<User>({
  defaultValue: { name: '', email: '', tags: [] },
  validations: {
    name: { required: (value) => !!value },
    email: { valid: (value) => value.includes('@') },
    'tags.*': { notEmpty: (value) => value.length > 0 },
  },
});
```

`createForm<TDraft, TOriginal = TDraft>(options)` returns a `Form` instance with components and hooks bound to that draft type. `TOriginal` can carry more than the draft (server ids, timestamps); it is what `original` and `field.originalValue` return.

Options (all can be overridden per `<Form>` element):

- `defaultValue` - the draft when there is no `original`.
- `original?` - the value the draft is compared to and, when untouched, reads through to. Typically the server state.
- `validations?` - `{ [path]: { [name]: (value, { draft, original, field }) => boolean } }`. Paths may contain `*` wildcards. A failing validation adds `name` to the field's errors. Alternatively a function `({ draft, original }) => Iterable<{ name, error }>`.
- `localizeError?(error, field)` - map an error name to a message.
- `transform?(draft, { previousValue, ...form })` - runs after every change to derive or normalise values. Returns the new draft, or nothing to keep it (e.g. after updating fields through the context); do not mutate it.
- `onOriginalChange?` - what happens to a touched draft when `original` changes: `'default'` keeps the draft, `'overwrite'` replaces it, `'merge'` takes over fields the user did not change, or a custom `(oldOriginal, newOriginal, draft, form) => draft` handler. An untouched draft always follows the original.
- `autoSave?` - `{ save(draft, prev, form), debounce?, validateBeforeSave?, resetAfterSave?, equals? }`. Saves the draft after it stopped changing for `debounce` (default 2 s).
- `reportValidity?` - how `validate()` reports errors: `'browser'` (default, native bubbles), `'scrollTo'` (scroll to the first invalid input), `false`.
- `validatedClass?` - class added to the `<form>` once validations were triggered (default `'validated'`). The form element also carries `data-validated` and `data-valid`.
- `transformFieldProps?(props, info, form)` - adjust the props every field receives, e.g. to wire a UI library's error prop.
- `onSubmit?(event, state)` - called after validation passed.

### Render the form

```tsx
function UserEditor({ user, save }: { user: User; save: (draft: User) => Promise<void> }) {
  return (
    <userForm.Form original={user} onSubmit={(_event, { draft }) => save(draft)}>
      <userForm.Field name="name" render={(props) => <input {...props} />} />
      <userForm.Field
        name="email"
        render={(props, { errors }) => (
          <>
            <input {...props} />
            {errors.join(', ')}
          </>
        )}
      />

      <userForm.ForEach
        name="tags"
        renderElement={({ name, remove }) => (
          <div>
            <userForm.Field name={name} render={(props) => <input {...props} />} />
            <button type="button" onClick={remove}>
              remove
            </button>
          </div>
        )}
      >
        {({ add }) => (
          <button type="button" onClick={() => add('')}>
            add tag
          </button>
        )}
      </userForm.ForEach>

      <userForm.FormState selector={(state) => state.hasChanges}>
        {(hasChanges) => <button disabled={!hasChanges}>save</button>}
      </userForm.FormState>
    </userForm.Form>
  );
}
```

- `<Form>` renders a `<form>` element (all `<form>` props are passed through), validates on submit and only calls `onSubmit` when valid. Nothing is written back until you do it in `onSubmit` or `autoSave`.
- `<Field name render>` binds a path of the draft. `render` receives the input props (`name`, `value`, `onChange`, `onBlur`, `data-invalid`), field info (`value`, `originalValue`, `hasChange`, `errors`, `hasTriggeredValidations`) and the form context. `onChange` accepts a value or an event with `target.value`. `commitOnBlur` and `commitDebounce` keep keystrokes local until blur or a pause.
- `<ForEach name>` iterates an array or record. `renderElement` gets the element's `name` path, `key`, `index`, `count` and a `remove` callback; `getCustomKey` provides stable keys for arrays; `filter` hides elements; the children function gets `names`, `add`, `remove`, `setValue`.
- `<FormState selector>` re-renders its children only when the selected value changes. The state has `draft`, `original`, `hasChanges`, `errors`, `isValid`, `hasTriggeredValidations`, `saveInProgress` and `form`.

Everything is also available as hooks inside the form: `useForm()` (the context), `useFormState(selector)`, `useField(name)`, `useFieldProps(name, options)`. When you cannot import the form instance, `useClosestForm()` returns the nearest one.

### The form context

`useForm()` returns the context, also passed to `onSubmit`, `transform` and `render` callbacks. Its methods read the current state without subscribing, which makes them safe to call in event handlers:

```ts
const form = userForm.useForm();

form.getDraft(); // the current draft
form.getField('email'); // { value, setValue, removeValue, originalValue, hasChange, errors, ... }
form.hasChanges();
form.getErrors(); // Map<path, string[]>
form.validate(); // marks validations as triggered, reports and returns isValid
form.reset(); // back to the original
form.flushAutosave(); // save now, resolves when done
form.original; // the real original, e.g. with server-only properties
form.formState; // the underlying store
```

### Working copies

A working copy isolates part of the UI - typically a dialog - so edits made there do not reach the form until applied:

```tsx
<userForm.Form original={user}>
  <userForm.ForEach name="tags" renderElement={({ name }) => <TagRow name={name} />} />
</userForm.Form>;

function TagRow({ name }: { name: `tags.${number}` }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <userForm.Field
        name={name}
        render={({ value }) => <span onClick={() => setOpen(true)}>{value}</span>}
      />

      {open && (
        <Dialog>
          <userForm.WorkingCopy>
            {(copy) => (
              <>
                <userForm.Field name={name} render={(props) => <input {...props} />} />
                <button
                  type="button"
                  onClick={() => {
                    copy.discard();
                    setOpen(false);
                  }}
                >
                  cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (copy.validate()) {
                      copy.apply();
                      setOpen(false);
                    }
                  }}
                >
                  ok
                </button>
              </>
            )}
          </userForm.WorkingCopy>
        </Dialog>
      )}
    </>
  );
}
```

Inside `<WorkingCopy>` every component and hook of the form works as usual but reads and writes the copy's own draft. Field names are the same full paths as outside.

- The render function receives the copy: its form context plus `apply` and `discard`. Hooks called directly in that function still belong to the surrounding component and would see the outer form.
- `apply()` writes the copy's edits into the form and resets the copy. Only the paths the copy changed are written, so changes made to the form in the meantime survive unless they touch the same paths. It does not validate; call `validate()` on the copy first if you want that.
- `discard()` drops the copy's edits. Unmounting the copy does the same.
- `hasChanges()` inside the copy means "changed in this copy". `original`, `field.originalValue` and validations still see the real original; the form it was branched from is `parent`. Whether validations were already triggered is taken from the form once, at mount.
- The copy starts from a snapshot of the form's draft taken when it mounts. Later changes of the form do not reach the copy's draft. `useFormState` inside the copy gets the form's derived state as `parent` (`useFormState((s) => s.parent?.hasChanges)`) and follows its changes. After `apply()` the snapshot is the form's draft as of that apply.
- `onApply={(workingDraft, parentDraft, form) => ...}` replaces the default diff-and-patch. Return the new parent draft (`({ ...parentDraft, address: workingDraft.address })`) or nothing to keep it, e.g. after updating fields through `form.parent`; do not mutate the arguments. Default patches are index based for arrays, so removing an element outside the copy before the one being edited shifts the edit.
- Copies nest; `apply()` writes one level up.
- `useWorkingCopy()` returns the same copy from any component inside it, where `useForm()` also returns the copy's context. A `ref` on `<WorkingCopy>` receives it too.
- The copy shares the surrounding `<form>` element and, once `form.validate()` was called on it, writes its errors to that element's inputs. Pressing Enter in a copy's input submits that form. Inputs rendered through a portal are outside the form element: native validity (`reportValidity: 'browser'` bubbles, `:invalid`) does not reach them, so rely on `errors` / `data-invalid` there.
