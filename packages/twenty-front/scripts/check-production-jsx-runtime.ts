/* oxlint-disable no-console */
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Vite resolves `isProduction` from `process.env.NODE_ENV === 'production'`
// (see `jsxDev: !isProduction` in vite's resolveConfig). A library built
// without that variable emits `react/jsx-dev-runtime` imports, while the
// paired production React runtime exports `jsxDEV = void 0`. Any application
// that bundles such a dependency then crashes at render time with
// `TypeError: (0, c.jsxDEV) is not a function` (verified in BI-01-R2).
//
// This guard fails the production build when that happens instead of shipping
// a frontend that cannot render.
//
// Workspace dependencies are located through Node module resolution and
// `realpath`, not by assuming sibling directories: during BI-01-R2 a
// `node_modules` junction made the frontend bundle artifacts from a *different*
// worktree, so a guard that inspected `packages/<name>/dist` by path alone
// could report OK while the shipped bundle came from somewhere else.
const requireFromScript = createRequire(import.meta.url);

const FRONT_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// `realpath` both here and on every resolved package so a symlinked or
// junctioned checkout cannot make two different trees look like one.
const WORKSPACE_ROOT = realpathSync(resolve(FRONT_PACKAGE_ROOT, '../..'));

const DEV_RUNTIME_IMPORT =
  /\bfrom\s*["']react\/jsx-dev-runtime["']|\brequire\(\s*["']react\/jsx-dev-runtime["']\s*\)/;

// Only executable calls are rejected. Bundled parsers, validators and error
// messages legitimately mention `jsxDEV` as text (typescript worker, babel
// helpers, react-markdown), and the development runtime itself only defines
// `jsxDEV = void 0`, so a bare `jsxDEV` match would be a false positive.
const DEV_RUNTIME_CALL = /(?:^|[^A-Za-z0-9$])jsxDEV\s*\)?\s*\(/;

const SCRIPT_EXTENSIONS = ['.js', '.mjs', '.cjs'];

const requireFrontBuild = process.argv.includes('--require-front-build');

type GuardTarget = {
  label: string;
  directory: string;
  required: boolean;
};

type PackageTarget = {
  label: string;
  specifier: string;
  packageName: string;
  artifactDirectory: string;
  required: boolean;
};

const failures: string[] = [];

const fail = (message: string): void => {
  failures.push(message);
  console.error(`[check-production-jsx-runtime] ${message}`);
};

const readPackageName = (directory: string): string | null => {
  const packageJsonPath = join(directory, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      name?: string;
    };

    return packageJson.name ?? null;
  } catch {
    return null;
  }
};

// Resolves the entry point Node/Jest/Vite actually use for `specifier`, then
// walks to the owning package root. `realpath` collapses the workspace symlink
// so the returned directory is the tree the bundler reads from.
const resolvePackageRoot = (
  specifier: string,
  expectedPackageName: string,
): string => {
  const entryPoint = requireFromScript.resolve(specifier);
  let directory = dirname(realpathSync(entryPoint));

  for (;;) {
    if (readPackageName(directory) === expectedPackageName) {
      return directory;
    }

    const parentDirectory = dirname(directory);

    if (parentDirectory === directory) {
      throw new Error(
        `No package.json named "${expectedPackageName}" above ${entryPoint}`,
      );
    }

    directory = parentDirectory;
  }
};

const isInsideWorkspace = (candidate: string): boolean => {
  const relativePath = relative(WORKSPACE_ROOT, candidate);

  return (
    relativePath !== '' &&
    !relativePath.startsWith('..') &&
    !isAbsolute(relativePath)
  );
};

const packageTargets: PackageTarget[] = [
  {
    label: 'twenty-ui dist',
    specifier: 'twenty-ui',
    packageName: 'twenty-ui',
    artifactDirectory: 'dist',
    required: true,
  },
  {
    label: 'twenty-front-component-renderer dist',
    specifier: 'twenty-front-component-renderer',
    packageName: 'twenty-front-component-renderer',
    artifactDirectory: 'dist',
    required: true,
  },
];

const targets: GuardTarget[] = [
  {
    label: 'twenty-front build output',
    directory: join(FRONT_PACKAGE_ROOT, 'build/assets'),
    required: requireFrontBuild,
  },
];

for (const packageTarget of packageTargets) {
  let packageRoot: string;

  try {
    packageRoot = resolvePackageRoot(
      packageTarget.specifier,
      packageTarget.packageName,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (packageTarget.required) {
      fail(
        `Cannot resolve ${packageTarget.specifier} (${reason}). The frontend build consumes it, so its production artifact is missing.`,
      );
    } else {
      console.log(
        `[check-production-jsx-runtime] Skip ${packageTarget.label} (unresolved).`,
      );
    }

    continue;
  }

  if (!isInsideWorkspace(packageRoot)) {
    fail(
      `${packageTarget.specifier} resolves outside this worktree (${packageRoot}, expected under ${WORKSPACE_ROOT}). The frontend would bundle artifacts from another checkout.`,
    );

    continue;
  }

  targets.push({
    label: `${packageTarget.label} [${relative(WORKSPACE_ROOT, packageRoot)}]`,
    directory: join(packageRoot, packageTarget.artifactDirectory),
    required: packageTarget.required,
  });
}

const collectScriptFiles = (directory: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectScriptFiles(entryPath));
      continue;
    }

    if (SCRIPT_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(entryPath);
    }
  }

  return files;
};

type Violation = {
  file: string;
  kind: 'import' | 'call';
  snippet: string;
};

const inspectFile = (file: string): Violation[] => {
  const source = readFileSync(file, 'utf8');
  const violations: Violation[] = [];

  const importMatch = DEV_RUNTIME_IMPORT.exec(source);

  if (importMatch !== null) {
    violations.push({
      file,
      kind: 'import',
      snippet: importMatch[0],
    });
  }

  const callMatch = DEV_RUNTIME_CALL.exec(source);

  if (callMatch !== null) {
    violations.push({
      file,
      kind: 'call',
      snippet: callMatch[0],
    });
  }

  return violations;
};

const violations: Violation[] = [];
let inspectedDirectoryCount = 0;

for (const target of targets) {
  if (!existsSync(target.directory)) {
    if (target.required) {
      fail(`Missing ${target.label} at ${target.directory}.`);
    } else {
      console.log(
        `[check-production-jsx-runtime] Skip ${target.label} (not built).`,
      );
    }

    continue;
  }

  inspectedDirectoryCount += 1;

  for (const file of collectScriptFiles(target.directory)) {
    violations.push(...inspectFile(file));
  }
}

if (violations.length > 0) {
  console.error(
    '[check-production-jsx-runtime] Development JSX runtime found in production artifacts:',
  );

  for (const violation of violations) {
    console.error(
      `  - ${relative(WORKSPACE_ROOT, violation.file)} (${violation.kind}: ${violation.snippet.trim()})`,
    );
  }

  console.error(
    '\nRebuild the offending package with NODE_ENV=production (for example `npx nx build twenty-ui --skip-nx-cache`).',
  );
}

if (violations.length > 0 || failures.length > 0) {
  process.exitCode = 1;
} else if (inspectedDirectoryCount === 0) {
  console.error(
    '[check-production-jsx-runtime] No production artifacts were found to inspect.',
  );

  process.exitCode = 1;
} else {
  console.log(
    `[check-production-jsx-runtime] OK: ${inspectedDirectoryCount} artifact directories contain no development JSX runtime.`,
  );
}
