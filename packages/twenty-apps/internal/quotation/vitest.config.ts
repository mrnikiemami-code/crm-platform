import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// The SDK's own dependency tree ships a second React. A component rendered with the
// workspace's react-dom against that copy gets a null hook dispatcher, so both React and
// React DOM are pointed at the workspace copies: one instance per test run.
const workspaceModule = (name: string) =>
  fileURLToPath(new URL(`../../../../node_modules/${name}`, import.meta.url));

// Dependency-free: resolves the app's own `src/*` and `~/*` aliases without
// requiring a path-mapping plugin.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: [
      { find: /^react$/, replacement: workspaceModule('react') },
      { find: /^react-dom$/, replacement: workspaceModule('react-dom') },
      { find: /^react\//, replacement: `${workspaceModule('react')}/` },
      { find: /^react-dom\//, replacement: `${workspaceModule('react-dom')}/` },
      { find: /^src\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
      { find: /^~\//, replacement: fileURLToPath(new URL('./', import.meta.url)) },
    ],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
