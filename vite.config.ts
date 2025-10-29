import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

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
    pool: 'forks',
    execArgv: ['--expose-gc'],
    typecheck: {
      tsconfig: 'test/tsconfig.json',
      enabled: true,
    },
  },
});
