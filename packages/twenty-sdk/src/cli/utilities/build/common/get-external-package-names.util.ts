import { builtinModules } from 'node:module';
import path from 'path';

// esbuild only leaves a specifier unresolved at run time when it is external, so
// that list — not the source imports — is what the executor must be able to
// resolve. Host modules and the platform SDK are supplied by Twenty itself.
const NODE_BUILTIN_MODULE_NAMES = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

const toPackageName = (specifier: string): string => {
  const segments = specifier.split(path.posix.sep);

  return segments[0].startsWith('@')
    ? `${segments[0]}/${segments[1]}`
    : segments[0];
};

export const getExternalPackageNames = (
  metafile:
    | {
        outputs: Record<
          string,
          { imports?: { path: string; external?: boolean }[] }
        >;
      }
    | undefined,
): Set<string> => {
  const externalPackageNames = new Set<string>();

  if (metafile === undefined) {
    return externalPackageNames;
  }

  for (const output of Object.values(metafile.outputs)) {
    for (const importEntry of output.imports ?? []) {
      if (importEntry.external !== true) {
        continue;
      }

      if (NODE_BUILTIN_MODULE_NAMES.has(importEntry.path)) {
        continue;
      }

      externalPackageNames.add(toPackageName(importEntry.path));
    }
  }

  return externalPackageNames;
};
