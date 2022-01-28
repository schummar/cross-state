/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    open: true,
    setupFiles: ['./test/_setup.ts'],
  },
});
