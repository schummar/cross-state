/// <reference types="vitest" />
import { isAbsolute } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    open: true,
    include: ['./src/**/*.test.{ts,tsx}'],
    exclude: ['**/_*'],
  },

  build: {
    sourcemap: true,
    minify: true,

    lib: {
      entry: './src/index.ts',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      input: {
        index: './src/index.ts',
        react: './src/integrations/react/index.ts',
        immer: './src/integrations/immer/index.ts',
      },
      output: {
        entryFileNames: '[format]/[name].js',
        chunkFileNames: '[format]/[name].js',
      },
      external: (source) => {
        return !(isAbsolute(source) || source.startsWith('.'));
      },
    },
  },
});
