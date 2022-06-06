/// <reference types="vitest" />
import { isAbsolute } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],

  test: {
    environment: 'happy-dom',
    include: ['./src/**/*.test.{ts,tsx}'],
    exclude: ['**/_*'],
    setupFiles: ['./src/lib/testSetup.ts'],
    api: { port: 6200, strictPort: true },
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
