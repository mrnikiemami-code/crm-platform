import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Dependency-free: resolves the app's own `src/*` and `~/*` aliases without
// requiring a path-mapping plugin.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      src: fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
