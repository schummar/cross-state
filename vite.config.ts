/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { peerDependencies } from './package.json';

export default defineConfig({
  test: {
    environment: 'jsdom',
    open: true,
    setupFiles: ['./test/_setup.ts'],
  },

  build: {
    sourcemap: true,
    minify: true,

    lib: {
      entry: 'src-new/index.ts',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      input: {
        index: 'src-new/index.ts',
        // react: 'src/react/index.ts',
      },
      output: {
        entryFileNames: '[format]/[name].js',
        chunkFileNames: '[format]/[name].js',
      },
      external: Object.keys(peerDependencies),
    },
  },
});
