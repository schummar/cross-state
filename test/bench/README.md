# Benchmarks

Performance baseline for the core primitives. The point is not absolute numbers — those depend on
the machine — but to make regressions and optimizations visible as relative changes against a
baseline recorded on the _same_ machine.

```bash
pnpm bench                  # run everything
pnpm bench:baseline         # run and record .bench/baseline.json
pnpm bench:compare          # run and compare against .bench/baseline.json
pnpm exec vp test bench store            # filter by file name
pnpm exec vp test bench -t 'deepEqual'   # filter by benchmark name
```

`.bench/` is git-ignored, so a baseline stays local.

## Suites

| File               | Covers                                                               |
| ------------------ | -------------------------------------------------------------------- |
| `store.bench.ts`   | `set` / `get` / `subscribe`, subscriber fan-out, store methods       |
| `derived.bench.ts` | `map`, map chains, computed stores with `use()`, cached reads        |
| `equals.bench.ts`  | `strictEqual` / `shallowEqual` / `deepEqual` across shapes and sizes |
| `lib.bench.ts`     | `get`/`set` by path, `diff`, `applyPatches`, `hash`, `trackingProxy` |
| `react.bench.tsx`  | `useStore` with selectors, whole state, and the tracking proxy       |

Files prefixed with `_` are fixtures and setup, not suites.

## Conventions

- Each `describe` is a comparison group; the reporter ranks entries within a group, so only put
  benchmarks in the same group when comparing them is meaningful.
- Anything a benchmark should not measure is built up front. `cycler` from `_fixtures` hands out
  precomputed values so the measured body only does the operation under test.
- Store values are pushed through `observe` so results can't be optimized away.
- Two state sizes recur: a 3-key object ("small state") and a 1000-item record ("big state"),
  both from `_fixtures`. Big-state benchmarks distinguish where the change sits, because
  `deepEqual` bails out on the first difference: a change in the first compared key is cheap, a
  change in the last item costs a full traversal, and a fresh-but-equal object graph is the worst
  case.
