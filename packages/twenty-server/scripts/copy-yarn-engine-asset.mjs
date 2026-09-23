import { cpSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(
  packageRoot,
  'src/engine/core-modules/application/application-package/constants/yarn-engine/.yarn',
);
const destination = join(
  packageRoot,
  'dist/assets/engine/core-modules/application/application-package/constants/yarn-engine/.yarn',
);

mkdirSync(dirname(destination), { recursive: true });
cpSync(source, destination, { recursive: true });
