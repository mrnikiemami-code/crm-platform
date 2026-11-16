import { relative, sep } from 'path';
import { type Manifest, OUTPUT_DIR } from 'twenty-shared/application';
import { FileFolder } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import type { EntityFilePaths } from '@/cli/utilities/build/manifest/manifest-extract-config';

// Must stay in sync with writeRuntimeDependencies and the server's installer:
// a root-level yarn.lock is dropped by `npm pack`, so the copy that travels in
// the tarball sits one directory down.
export const SHIPPED_YARN_LOCK_RELATIVE_PATH = 'dependencies/yarn.lock';

export type ManifestBuildResult = {
  manifest: Manifest | null;
  filePaths: EntityFilePaths;
  error?: string;
};

export type UpdateManifestChecksumParams = {
  manifest: Manifest;
  builtFileInfos: Map<
    string,
    {
      checksum: string;
      builtPath: string;
      fileFolder: FileFolder;
      usesSdkClient?: boolean;
    }
  >;
};

export const manifestUpdateChecksums = ({
  manifest,
  builtFileInfos,
}: UpdateManifestChecksumParams): Manifest => {
  let result = structuredClone(manifest);
  for (const [
    builtPath,
    { fileFolder, checksum },
  ] of builtFileInfos.entries()) {
    const rootBuiltPath = relative(OUTPUT_DIR, builtPath);
    // `relative` yields platform separators while the manifest stores POSIX
    // paths, so compare on a normalised form.
    const normalizedRootBuiltPath = rootBuiltPath.split(sep).join('/');
    if (fileFolder === FileFolder.BuiltLogicFunction) {
      const logicFunctions = result.logicFunctions;
      const fnIndex = logicFunctions.findIndex(
        (f) => f.builtHandlerPath === rootBuiltPath,
      );
      if (fnIndex === -1) {
        continue;
      }
      result = {
        ...result,
        logicFunctions: logicFunctions.map((fn, index) =>
          index === fnIndex ? { ...fn, builtHandlerChecksum: checksum } : fn,
        ),
      };
    }

    if (fileFolder === FileFolder.PublicAsset) {
      const assets = result.publicAssets;
      const assetIndex = assets.findIndex((a) => a.filePath === rootBuiltPath);
      if (assetIndex === -1) {
        continue;
      }
      result = {
        ...result,
        publicAssets: assets.map((asset, index) =>
          index === assetIndex ? { ...asset, checksum } : asset,
        ),
      };
      continue;
    }

    if (fileFolder === FileFolder.BuiltFrontComponent) {
      const sharedDependencies =
        result.application.frontComponentSharedDependencies;

      if (
        isDefined(sharedDependencies) &&
        sharedDependencies.builtPath === rootBuiltPath
      ) {
        result = {
          ...result,
          application: {
            ...result.application,
            frontComponentSharedDependencies: {
              ...sharedDependencies,
              builtChecksum: checksum,
            },
          },
        };
        continue;
      }

      const frontComponents = result.frontComponents;
      const componentIndex =
        frontComponents.findIndex(
          (c) => c.builtComponentPath === rootBuiltPath,
        ) ?? -1;
      if (componentIndex === -1) {
        continue;
      }
      const builtFileInfo = builtFileInfos.get(builtPath);

      result = {
        ...result,
        frontComponents: frontComponents.map((component, index) =>
          index === componentIndex
            ? {
                ...component,
                builtComponentChecksum: checksum,
                usesSdkClient: builtFileInfo?.usesSdkClient ?? false,
              }
            : component,
        ),
      };
    }

    if (fileFolder === FileFolder.Dependencies) {
      if (normalizedRootBuiltPath === 'package.json') {
        result.application.packageJsonChecksum = checksum;
      }

      // The shipped lockfile lives under dependencies/ because a root-level
      // lockfile never survives `npm pack`.
      if (normalizedRootBuiltPath === SHIPPED_YARN_LOCK_RELATIVE_PATH) {
        result.application.yarnLockChecksum = checksum;
      }
    }
  }

  return result;
};
