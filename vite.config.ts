import { tmpdir } from 'os';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  test: {
    environment: 'happy-dom',
    include: ['./{src,test}/**/*.test.{ts,tsx}'],
    exclude: ['**/_*'],
    setupFiles: ['./test/testSetup.ts'],
    pool: 'forks',
    execArgv: ['--expose-gc', `--localstorage-file=${tmpdir()}/cross-state-localstorage`],
    typecheck: {
      tsconfig: 'test/tsconfig.json',
      enabled: true,
    },
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
    },
  },

  pack: {
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
