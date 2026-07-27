import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // esbuild's automatic JSX runtime transforms TSX; no react plugin needed
  // (fast refresh is irrelevant in tests).
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
