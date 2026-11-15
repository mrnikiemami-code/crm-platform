import { relative, sep } from 'path';

/**
 * A manifest path, relative to the app root, as a package stores it.
 *
 * Why this exists: `path.relative` answers in the HOST's separator, so on Windows
 * it returns `src\logic-functions\save.mjs` while the published archive always
 * stores `src/logic-functions/save.mjs`. The installer resolves manifest entries
 * inside the archive, so a backslash makes it look for a file that is not there
 * and the install fails on the first logic function.
 *
 * Normalising here — rather than at each call site — keeps the rule in one place:
 * a path in the manifest is a POSIX path, on every machine that builds the app.
 */
export const toPackagePath = (pathFromAppRoot: string): string =>
  pathFromAppRoot.split(sep).join('/');

/** The package path of `filePath` measured from `appPath`. */
export const toRelativePackagePath = ({
  appPath,
  filePath,
}: {
  appPath: string;
  filePath: string;
}): string => toPackagePath(relative(appPath, filePath));
