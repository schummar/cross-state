import type { BenchRegistration, TestContext } from 'vite-plus/test';

export type BenchCases = Record<string, () => unknown>;

/** `import.meta.env` only exists under Vite's module runner, which benchmarks run without. */
const env: Record<string, string | undefined> =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ??
  import.meta.env;

/** Set to record a version; recording again under the same name overwrites it. */
const version: string | undefined = env['VITE_BENCH_VERSION'];

/** Comma-separated versions to show alongside the current run. */
const baselines: string[] = env['VITE_BENCH_BASELINE']?.split(',').filter(Boolean) ?? [];

/** Names become path segments, and contain spaces, commas, dots and parens. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

export async function benchGroup({ bench, task }: TestContext, cases: BenchCases): Promise<void> {
  const group = slug(task.fullTestName);
  const file = (v: string, name: string) => `.bench/${slug(v)}/${group}/${slug(name)}.json`;

  for (const [name, fn] of Object.entries(cases)) {
    const entries: BenchRegistration<string>[] = baselines.map((v) =>
      bench.from(`${name} [${v}]`, file(v, name)),
    );

    if (version) {
      entries.push(bench(name, { writeResult: file(version, name) }, fn));
    } else {
      entries.push(bench(name, fn));
    }

    if (entries.length > 1) {
      await bench.compare(...entries);
    } else {
      await entries[0]!.run();
    }
  }
}
