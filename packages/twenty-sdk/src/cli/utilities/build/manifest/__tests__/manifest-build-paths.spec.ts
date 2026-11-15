import { RICH_APP_PATH } from '@/cli/__tests__/apps/fixture-paths';
import { buildManifest } from '@/cli/utilities/build/manifest/manifest-build';

// The manifest addresses files INSIDE the published package, and a package is
// platform-neutral: those paths must be `/`-separated everywhere. `path.relative`
// answers with `\` on Windows, so without normalisation the archive and the
// manifest disagree and the installer cannot find the file.
//
// The rich fixture is used because it carries all three kinds of path at once:
// logic functions, front components and a public asset.
describe('buildManifest package paths', () => {
  it('separates every packaged path with a forward slash', async () => {
    const { manifest, errors } = await buildManifest(RICH_APP_PATH);

    expect(errors).toEqual([]);

    const packagedPaths = [
      ...(manifest?.logicFunctions ?? []).flatMap((logicFunction) => [
        logicFunction.sourceHandlerPath,
        logicFunction.builtHandlerPath,
      ]),
      ...(manifest?.frontComponents ?? []).flatMap((frontComponent) => [
        frontComponent.sourceComponentPath,
        frontComponent.builtComponentPath,
      ]),
      ...(manifest?.publicAssets ?? []).map((publicAsset) => publicAsset.filePath),
    ];

    expect(packagedPaths.length).toBeGreaterThan(0);

    for (const packagedPath of packagedPaths) {
      expect(packagedPath).not.toContain('\\');
      // Relative to the app root, so it must never address the host filesystem.
      expect(packagedPath.startsWith('/')).toBe(false);
    }
  }, 60000);

  it('lists the source and built handler of a logic function under the same folder', async () => {
    const { manifest } = await buildManifest(RICH_APP_PATH);

    const logicFunction = manifest?.logicFunctions[0];

    expect(logicFunction).toBeDefined();
    expect(logicFunction?.builtHandlerPath).toMatch(/\.mjs$/);
    expect(logicFunction?.sourceHandlerPath).toMatch(/\.tsx?$/);
    expect(logicFunction?.builtHandlerPath.split('/').slice(0, -1)).toEqual(
      logicFunction?.sourceHandlerPath.split('/').slice(0, -1),
    );
  }, 60000);

  it('addresses the public asset as it sits in the package', async () => {
    const { manifest } = await buildManifest(RICH_APP_PATH);

    const asset = manifest?.publicAssets.find(
      (publicAsset) => publicAsset.fileName === 'favicon.png',
    );

    expect(asset?.filePath).toBe('public/favicon.png');
  }, 60000);
});
