---
name: migrate-to-path-validators
description: Migrate a codebase that uses cross-state to the release where paths are validated per call (ValidPath and friends), form validations are functions only, the legacy `<form.Field component=…>` is gone and the Path/PathAsString/SettablePath/WildcardPath types are removed. Use when upgrading cross-state and the type check reports errors on paths, on form `validations`, on `component=` fields or on missing path types.
---

# Migrate to cross-state's path validators

cross-state no longer builds the union of every path of a type. Each API takes the path as a
generic `P` and checks that one path, segment by segment. Types stay cheap, errors name the
segments that would have been valid, and completions offer the next segment as you type.

Literal paths (`store.set('a.b', 1)`, `form.useField('items.0.name')`), template literal paths
(`` `${name}.title` ``) and `any` compile unchanged. Work through the steps below, then run the
project's type check until it is clean.

## 1. Form validations: objects become a function

`validations` is now only `({ draft, original, fieldError }) => Iterable<{ name, error }>`, usually
a generator. The object form (`{ [path]: { [errorName]: (value, context) => boolean } }`) and the
`Validation` type are gone.

```ts
// before
validations: {
  name: { required: (value) => !!value },
  validTo: { order: (value, { draft }) => !value || value > draft.validFrom },
  'slots.*.mediaUrls': { required: (value) => value.some((url) => url.length > 0) },
},

// after
import { matches } from 'cross-state';

validations: function* ({ draft, fieldError }) {
  if (!draft.name) yield fieldError('name', 'required');
  if (draft.validTo && draft.validTo <= draft.validFrom) yield fieldError('validTo', 'order');

  for (const [name, urls] of matches(draft, 'slots.*.mediaUrls')) {
    if (!urls.some((url) => url.length > 0)) yield fieldError(name, 'required');
  }
},
```

Rules for converting each entry:

- A rule returned `true` when valid. Yield when the value is **invalid**, so negate the condition.
  The error name stays the same, so `localizeError` and translations keep working.
- `fieldError(path, error)` checks `path` against the draft. Names from `matches` are accepted as
  they are. A plain `{ name, error }` object is still allowed for names that are not paths (e.g. a
  form-level `'custom'` error).
- Wildcard keys become a `matches(draft, 'a.*.b')` loop, which yields `[name, value]` per concrete
  path. When the rule needs the element's index or siblings, as code that used `field.split('.')`
  did, loop over the data instead: `for (const [i, slot] of draft.slots.entries())` and
  ``fieldError(`slots.${i}.mediaUrls`, …)``.
- A rule on a path that does not exist in the draft yet was called with `undefined`. Now you read
  the value from `draft` yourself, so check for missing values explicitly.
- Rule factories like `slotsValidations(limit)` that returned an object become generator functions
  that take the context and the parameters: `function* slotRules(ctx, limit) { … }`, used with
  `yield* slotRules(ctx, limit)`.
- `validations` passed to `<form.Form>` used to be merged key by key with the ones from
  `createForm`. They now replace them. To keep both, call the form's own rules first:

  ```tsx
  <form.Form
    validations={function* (context) {
      yield* form.options.validations?.(context) ?? [];
      yield* slotRules(context, loadedLimit);
    }}
  />
  ```

## 2. Replace `<form.Field component={…}>`

The deprecated `component` overload and the `FormFieldComponent` type are gone. Use `render` (or
`children`). The render props are `{ name, value, onChange, onBlur, 'data-invalid' }`; `onChange`
takes an event or a value.

| before                                                | after                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `component={X}` plus extra props                      | `render={(props) => <X {...props} extra="…" />}`                         |
| `defaultValue={d}`                                    | `value={props.value ?? d}` inside `render`                               |
| `serialize={(v) => s(v)}`                             | `value={s(props.value)}`                                                 |
| `deserialize={(x) => d(x)}`                           | `onChange={(e) => props.onChange(d(e.target.value))}`                    |
| `inputFilter={(x) => ok(x)}`                          | `onChange={(e) => ok(e.target.value) && props.onChange(e)}`              |
| `onChange={f}` / `onBlur={g}` passed to the component | call `f`/`g` in your own handler next to `props.onChange`/`props.onBlur` |

`commitOnBlur` and `commitDebounce` stay on `<form.Field>` itself.

## 3. Removed path types

`Path`, `PathAsString`, `PathAsArray`, `SettablePath`, `SettablePathAsString`,
`SettablePathAsArray`, `WildcardPath`, `WildcardPathAsString` and `WildcardPathAsArray` are gone.
`AnyPath`, `Value`, `WildcardValue` and the validators below are exported instead.

A function or component that takes a path and passes it on keeps the path generic and validates
it with the type that matches the API it ends up in:

```ts
// before
function useThing<TPath extends PathAsString<Draft>>(path: TPath) {
  return get(draft, path);
}
interface Props<TName extends string> {
  name: TName extends PathAsString<Draft> ? TName : PathAsString<Draft>;
}

// after
function useThing<const TPath extends string>(path: ValidPath<Draft, TPath>) {
  return get(draft, path);
}
interface Props<TName extends string> {
  name: ValidPath<Draft, TName>;
}
```

| API                                                                             | type                      |
| ------------------------------------------------------------------------------- | ------------------------- |
| `get`, `store.set`, `useStore`, `useScopeStore`, form `name`s, `cache.mapValue` | `ValidPath<T, P>`         |
| `set` from `cross-state`, `store.map`, `useProp`                                | `ValidSettablePath<T, P>` |
| `remove`                                                                        | `ValidOptionalPath<T, P>` |
| `persist` paths, `matches`                                                      | `ValidWildcardPath<T, P>` |

Keep `const` on the type parameter so literals stay literal. When the path is passed inside an
object or as a JSX prop, also constrain it (`const P extends string` or `const P extends AnyPath`):
otherwise TypeScript widens a ternary like `path={cond ? 'a.x' : 'a.y'}` to `string`, which is then
rejected.

Own types that mapped over all paths (e.g. `{ [P in PathAsString<Draft>]?: … }`) have no direct
replacement. Turn them into functions like the form validations above, or key them by `string`.

## 4. `persist`

- `persist(store, { paths })` checks each path on its own. Errors point at the wrong path.
- `PersistOptions` is no longer generic: write `PersistOptions` instead of `PersistOptions<T>`.
- Paths given in the `persist` option of `createStore` are no longer checked against the store's
  type. Call `persist(store, …)` if you want them checked.

## 5. Stricter checks

- Paths deeper than the old limit of 5 segments are now checked all the way. Errors there are real
  typos.
- Empty segments (`'a..b'`, `'a.'`) are rejected, also under `Record<string, …>`.
- A path held in a plain `string` is rejected unless the type accepts any key there (a record).
  Narrow it, or cast at the call site if it is checked at runtime.

## Finding the call sites

```bash
# object validations, in createForm options and on <form.Form>
rg -U --glob '*.{ts,tsx}' -n 'validations(:\s*\{|=\{\{)' src
# `component=` usually sits on its own line, and forms are often destructured (`<Field …>`)
rg -U --glob '*.tsx' -n '<[\w.]*Field\b[^>]*?\bcomponent=' src
# removed or changed types, wherever they are imported
rg -U --glob '*.{ts,tsx}' -n "import[^;]*\b(Path|PathAsString|PathAsArray|SettablePath\w*|WildcardPath\w*|Validation|FormFieldComponent|PersistOptions)\b[^;]*from 'cross-state[^']*'" .
```
