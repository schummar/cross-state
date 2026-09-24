import { tmpdir } from 'os';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  run: {
    tasks: {
      _bench: {
        command: 'vp test bench --run --reporter=verbose',
        dependsOn: ['_build'],
      },

      _lint: {
        command: 'vp check',
        dependsOn: ['_build'],
      },

      _build: {
        command: 'vp pack',
      },

      _size: {
        command: 'size-limit',
        dependsOn: ['_build'],
      },

      _test: {
        command: 'vp test run --coverage',
        dependsOn: ['_build'],
        input: [{ auto: true }, '!node_modules/**', '!coverage/**', '!test/testResults.xml'],
      },
    },
  },

  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    exclude: ['**/_*', '.worktrees'],
    pool: 'forks',
    execArgv: ['--expose-gc', `--localstorage-file=${tmpdir()}/cross-state-localstorage`],
    typecheck: {
      tsconfig: 'test/tsconfig.json',
      enabled: true,
    },

    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['./{src,test}/**/*.test.{ts,tsx}'],
          setupFiles: ['./test/testSetup.ts'],
          benchmark: { include: [] },
        },
      },
      {
        extends: true,
        test: {
          name: 'bench',
          include: [],
          environment: 'node',
          // These benchmarks import the built package, whose chunks reference each
          // other with real ESM bindings. Running them through Vite's module runner
          // would turn every one of those into a getter and fold that overhead into
          // the measurements, so Node loads them as native ESM instead. The cost is
          // that this project cannot run JSX — see the `bench-src` project.
          experimental: { viteModuleRunner: false },
          benchmark: {
            include: ['./test/bench/**/*.bench.ts'],
            exclude: ['**/*.src.bench.ts'],
          },
          typecheck: { enabled: false },
        },
      },
      {
        extends: true,
        test: {
          name: 'bench-src',
          include: [],
          environment: 'happy-dom',
          setupFiles: ['./test/testSetup.ts'],
          benchmark: { include: ['./test/bench/**/*.src.bench.{ts,tsx}'] },
          typecheck: { enabled: false },
        },
      },
    ],
  },

  fmt: {
    singleQuote: true,
    sortPackageJson: true,
    sortImports: {
      groups: [],
    },
  },

  lint: {
    plugins: ['react', 'react-perf', 'unicorn', 'typescript', 'oxc'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/no-this-in-sfc': 'off',
      'typescript/unbound-method': 'off',
      'typescript/no-redundant-type-constituents': 'off',
      'typescript/await-thenable': 'off',
      'react/refs': 'off',
    },
  },

  pack: {
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
    },
    entry: {
      index: 'src/index.ts',
      'react/index': 'src/react/index.ts',
      'react/register': 'src/react/register.ts',
      'mutative/index': 'src/mutative/index.ts',
      'mutative/register': 'src/mutative/register.ts',
      'patches/index': 'src/patches/index.ts',
      'patches/register': 'src/patches/register.ts',
      'persist/index': 'src/persist/index.ts',
      'persist/register': 'src/persist/register.ts',
    },
    platform: 'neutral',
    sourcemap: true,
    minify: false,
    target: 'esnext',
    format: ['cjs', 'es'],
    exports: true,
    publint: true,
  },
});
