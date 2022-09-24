/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],

  test: {
    environment: 'happy-dom',
    include: ['./test/**/{asyncStore,atomicStore,computed}.test.{ts,tsx}'],
    exclude: ['**/_*'],
    setupFiles: ['./test/testSetup.ts'],
  },

  build: {
    emptyOutDir: false,
    sourcemap: true,
    minify: false,

    lib: {
      entry: '',
      formats: ['es', 'cjs'],
    },

    rollupOptions: {
      input: {
        index: 'src/index.ts',
        'integrations/react': 'src/integrations/react/index.ts',
      },

      output: {
        entryFileNames: '[format]/[name].js',
        chunkFileNames: '[format]/[name].js',
      },
    },
  },
});
