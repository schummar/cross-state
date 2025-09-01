import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
    'react/register': 'src/react/register.ts',
    'mutative/index': 'src/mutative/index.ts',
    'mutative/register': 'src/mutative/register.ts',
    'patches/index': 'src/patches/index.ts',
    'patches/register': 'src/patches/register.ts',
    'persist/register': 'src/persist/register.ts',
  },
  sourcemap: true,
  minify: false,
  target: 'esnext',
  format: ['cjs', 'es'],
  exports: true,
});
