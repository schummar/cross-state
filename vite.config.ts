/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    tsconfigPaths(),
  ],

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
        'integrations/react': 'src/integrations/react/index.ts',
        'integrations/immer': 'src/integrations/immer/index.ts',
      },
    },

    rollupOptions: {
      output: [
        {
          dir: 'dist/es',
          format: 'es',
          entryFileNames: '[name].mjs',
          chunkFileNames: '[name].mjs',
        },
        {
          dir: 'dist/cjs',
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name].cjs',
        },
      ],
    },
  },
});
