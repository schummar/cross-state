/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],

  test: {
    environment: 'happy-dom',
    include: ['./test/**/*.test.{ts,tsx}'],
    exclude: ['**/_*'],
    setupFiles: ['./test/testSetup.ts'],
  },

  build: {
    emptyOutDir: false,
    sourcemap: true,
    minify: false,

    lib: {
      entry: {
        index: 'src/index.ts',
        react: 'src/react/index.ts',
        immer: 'src/immer/index.ts',
      },
    },

    rollupOptions: {
      output: [
        {
          format: 'es',
          entryFileNames: '[format]/[name].mjs',
          chunkFileNames: '[format]/[name].mjs',
        },
        {
          format: 'cjs',
          entryFileNames: '[format]/[name].cjs',
          chunkFileNames: '[format]/[name].cjs',
        },
      ],
      external: [
        //
        'react',
        'react/jsx-runtime',
        'immer',
      ],
    },
  },
});
