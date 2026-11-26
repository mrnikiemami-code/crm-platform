import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Cross-platform replacement for the Unix `mkdir -p` / `cp -r` post-build step.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePackageJson = join(packageRoot, '../twenty-client-sdk/package.json');
const sourceDist = join(packageRoot, '../twenty-client-sdk/dist');
const destinationRoot = join(packageRoot, 'dist/assets/twenty-client-sdk');

if (!existsSync(sourcePackageJson) || !existsSync(sourceDist)) {
  throw new Error(
    `twenty-client-sdk assets missing: expected ${sourcePackageJson} and ${sourceDist}`,
  );
}

mkdirSync(destinationRoot, { recursive: true });
cpSync(sourcePackageJson, join(destinationRoot, 'package.json'));
cpSync(sourceDist, join(destinationRoot, 'dist'), { recursive: true });
