import path from 'path';

// Path separators differ by platform: Windows uses `\`, POSIX uses `/`.
// Normalize them so the `/dist/` marker below is detected on every platform.
const toPosixSeparators = (filePath: string): string =>
  filePath.replace(/\\/g, '/');

// If the code is built through the testing module, assets are not output to the dist/assets directory.
export const isBuiltThroughTestingModule = (dirname: string): boolean =>
  !toPosixSeparators(dirname).includes('/dist/');

export const resolveAssetPath = (dirname: string): string =>
  isBuiltThroughTestingModule(dirname)
    ? path.resolve(dirname, `../`)
    : path.resolve(dirname, `../assets`);

export const ASSET_PATH = resolveAssetPath(__dirname);
