import { promises as fs } from 'fs';

type PackageJsonWithDependencies = {
  dependencies?: Record<string, string>;
};

// A dependency-free runtime package needs no yarn run at all, which is what lets
// the layer build without a reachable registry. A missing manifest is not the
// same thing as an empty one, so the read error propagates instead of being
// read as "nothing to install".
export const hasPackageJsonRuntimeDependencies = async (
  packageJsonPath: string,
): Promise<boolean> => {
  const content = await fs.readFile(packageJsonPath, 'utf-8');

  const packageJson = JSON.parse(content) as PackageJsonWithDependencies;

  return Object.keys(packageJson.dependencies ?? {}).length > 0;
};
