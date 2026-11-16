import { isDefined } from 'twenty-shared/utils';

// Node builtins come from the host and the SDK layer serves these as a
// downloaded archive, so declaring them would only force a registry install.
export const PLATFORM_PROVIDED_MODULE_NAMES: readonly string[] = [
  'twenty-sdk',
  'twenty-client-sdk',
];

export type ResolveRuntimeDependenciesResult = {
  dependencies: Record<string, string>;
  removedDependencyNames: string[];
};

// Declared dependencies describe what the source imported. What the executor has
// to install is narrower: only packages esbuild could not inline. Everything
// else already lives inside the built bundle.
export const resolveRuntimeDependencies = ({
  dependencies,
  externalPackageNames,
}: {
  dependencies: Record<string, string> | undefined;
  externalPackageNames: ReadonlySet<string>;
}): ResolveRuntimeDependenciesResult => {
  if (!isDefined(dependencies)) {
    return { dependencies: {}, removedDependencyNames: [] };
  }

  const keptDependencies: Record<string, string> = {};
  const removedDependencyNames: string[] = [];

  for (const [dependencyName, versionRange] of Object.entries(dependencies)) {
    const isResolvedAtRuntime =
      externalPackageNames.has(dependencyName) &&
      !PLATFORM_PROVIDED_MODULE_NAMES.includes(dependencyName);

    if (!isResolvedAtRuntime) {
      removedDependencyNames.push(dependencyName);
      continue;
    }

    keptDependencies[dependencyName] = versionRange;
  }

  return { dependencies: keptDependencies, removedDependencyNames };
};
