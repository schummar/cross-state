/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    //
    react(),
    tsconfigPaths(),
  ],

  test: {
    environment: 'happy-dom',
    include: ['./test/**/*.test.{ts,tsx}'],
    exclude: ['**/_*'],
    setupFiles: ['./test/testSetup.ts'],
    poolOptions: {
      forks: {
        execArgv: ['--expose-gc'],
      },
    },
    typecheck: {
      tsconfig: 'test/tsconfig.json',
      enabled: true,
    },
  },
});
