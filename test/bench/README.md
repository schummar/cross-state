# Benchmarks

Performance baseline for the core primitives. The point is not absolute numbers — those depend on
the machine — but to make regressions and optimizations visible as relative changes against a
baseline recorded on the _same_ machine.

```bash
pnpm bench                            # run everything
BENCH_VERSION=v1 pnpm bench           # run and record the results as version "v1"
BENCH_BASELINE=v1 pnpm bench          # run and show "v1" alongside the current numbers
BENCH_BASELINE=v1,v2 pnpm bench       # ... or several recorded versions at once
pnpm exec vp test bench store         # filter by file name
pnpm exec vp test bench -t 'diff'     # filter by group name
```

Both variables can be combined: `BENCH_VERSION=v3 BENCH_BASELINE=v1,v2 pnpm bench` records a new
version while showing the older ones in the same table.

## Versions

Recorded results live in `.bench/<version>/<group>/<benchmark>.json`, one file per benchmark.
Recording under a version name that already exists overwrites it.

`.bench/local/` is git-ignored — use `local` for throwaway before/after measurements. Any other
version name is committed, so a named baseline (a release, a refactor's starting point) travels
with the branch. Comparing only makes sense against numbers from the same machine, so treat a
committed version as a record of what that machine saw, not as a threshold to enforce in CI.

## Suites

| File                     | Project     | Covers                                                            |
| ------------------------ | ----------- | ----------------------------------------------------------------- |
| `store.bench.ts`         | `bench`     | `set` / `get` / `subscribe`, subscriber fan-out, store methods    |
| `derived.bench.ts`       | `bench`     | `map`, map chains, computed stores with `use()`, cached reads     |
| `equals.bench.ts`        | `bench`     | `strictEqual` / `shallowEqual` / `deepEqual` across shapes, sizes |
| `lib.bench.ts`           | `bench`     | `get`/`set` by path, `diff`, `applyPatches`, `hash`               |
| `react.src.bench.tsx`    | `bench-src` | `useStore` with selectors, whole state, and the tracking proxy    |
| `internals.src.bench.ts` | `bench-src` | `trackingProxy`                                                   |

Files prefixed with `_` are fixtures and setup, not suites.

## Why two projects

`pnpm bench` builds the package first, and `*.bench.ts` imports it by name (`cross-state`,
`cross-state/react`) rather than reaching into `src`. That project runs with Vite's module runner
disabled, so Node loads the built chunks as native ESM.

This matters more than it sounds. Under the module runner every cross-module import becomes a
getter, and that overhead lands inside the measurement — it cost `strictEqual` more than half its
throughput (30.6M/s native vs 14.0M/s through the runner). Vitest warns about this itself.

Native ESM cannot run JSX, and it cannot reach anything the package does not export. Those cases
live in `*.src.bench.{ts,tsx}` and the `bench-src` project, which keeps the module runner and the
DOM environment. Their numbers still carry the getter overhead, so compare them only against other
`bench-src` runs — never against a `bench` suite.

A consequence of benchmarking the built output: `pnpm bench` is only as current as the build it
runs, which is why the script builds first. Running vitest directly skips that step.

## Conventions

- One `test` is one comparison group. `benchGroup` from `_baseline` takes the group's benchmarks as
  a `name -> fn` object, runs them together and ranks them, so only put benchmarks in the same group
  when comparing them is meaningful. It also wires up recording and baselines, so nothing else in a
  suite deals with either.
- The group's path under `.bench/` comes from the test's full name, so renaming a `describe` or a
  `test` orphans its recorded versions.
- Anything a benchmark should not measure is built up front, inside the test body but outside the
  measured function. `cycler` from `_fixtures` hands out precomputed values so the measured body
  only does the operation under test.
- Store values are pushed through `observe` so results can't be optimized away.
- Two state sizes recur: a 3-key object ("small state") and a 1000-item record ("big state"),
  both from `_fixtures`. Big-state benchmarks distinguish where the change sits, because
  `deepEqual` bails out on the first difference: a change in the first compared key is cheap, a
  change in the last item costs a full traversal, and a fresh-but-equal object graph is the worst
  case.
