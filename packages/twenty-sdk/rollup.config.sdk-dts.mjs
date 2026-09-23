import path from 'node:path';
import dts from 'rollup-plugin-dts';

const external = (id) => {
  if (id === 'twenty-shared' || id.startsWith('twenty-shared/')) {
    return false;
  }
  if (id.startsWith('@/')) {
    return false;
  }
  // Absolute paths must be bundled. The previous `!id.startsWith('/')` check
  // only matched Unix paths, so on Windows resolved files (D:\...) were marked
  // external and written into .d.ts as broken absolute/`*.ts` re-exports.
  if (path.isAbsolute(id)) {
    return false;
  }
  return !id.startsWith('.');
};

const plugins = [
  dts({
    tsconfig: './tsconfig.lib.json',
    respectExternal: true,
  }),
];

export default [
  {
    input: 'src/sdk/define/index.ts',
    output: { file: 'dist/define/index.d.ts', format: 'es' },
    external,
    plugins,
  },
  {
    input: 'src/sdk/front-component/index.ts',
    output: { file: 'dist/front-component/index.d.ts', format: 'es' },
    external,
    plugins,
  },
  {
    input: 'src/sdk/billing/index.ts',
    output: { file: 'dist/billing/index.d.ts', format: 'es' },
    external,
    plugins,
  },
  {
    input: 'src/sdk/logic-function/index.ts',
    output: { file: 'dist/logic-function/index.d.ts', format: 'es' },
    external,
    plugins,
  },
  {
    input: 'src/sdk/utils/index.ts',
    output: { file: 'dist/utils/index.d.ts', format: 'es' },
    external,
    plugins,
  },
];
