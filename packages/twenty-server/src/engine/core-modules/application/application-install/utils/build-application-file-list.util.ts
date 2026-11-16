import { type Manifest } from 'twenty-shared/application';
import { FileFolder } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

export type ApplicationFileToStore = {
  relativePath: string;
  // Storage key, when it differs from the path inside the tarball.
  resourcePath?: string;
  fileFolder: FileFolder;
  isRequired: boolean;
};

// A root-level yarn.lock is dropped by `npm pack`, so packages built with the
// current SDK ship it one directory down. Packages published before that layout
// carry no lockfile at all, which is why the entry is only added when the
// manifest declares a checksum for it.
export const SHIPPED_YARN_LOCK_RELATIVE_PATH = 'dependencies/yarn.lock';

export const buildApplicationFileList = (
  manifest: Manifest,
): ApplicationFileToStore[] => {
  const declaresYarnLockChecksum = isDefined(
    manifest.application.yarnLockChecksum,
  );

  const files: ApplicationFileToStore[] = [
    {
      relativePath: 'package.json',
      fileFolder: FileFolder.Dependencies,
      isRequired: true,
    },
    // Only looked up when the manifest vouches for a lockfile: a package that
    // declares no checksum has no lockfile contract to verify.
    ...(declaresYarnLockChecksum
      ? [
          {
            relativePath: SHIPPED_YARN_LOCK_RELATIVE_PATH,
            resourcePath: 'yarn.lock',
            fileFolder: FileFolder.Dependencies,
            // A declared checksum without the file it describes is the exact
            // condition that used to degrade into a stub lockfile and a
            // registry install, so it fails the install instead.
            isRequired: true,
          },
        ]
      : []),
    {
      relativePath: 'manifest.json',
      fileFolder: FileFolder.Source,
      isRequired: true,
    },
  ];

  for (const logicFunction of manifest.logicFunctions ?? []) {
    files.push(
      {
        relativePath: logicFunction.sourceHandlerPath,
        fileFolder: FileFolder.Source,
        isRequired: false,
      },
      {
        relativePath: logicFunction.builtHandlerPath,
        fileFolder: FileFolder.BuiltLogicFunction,
        isRequired: true,
      },
    );
  }

  for (const frontComponent of manifest.frontComponents ?? []) {
    files.push(
      {
        relativePath: frontComponent.sourceComponentPath,
        fileFolder: FileFolder.Source,
        isRequired: false,
      },
      {
        relativePath: frontComponent.builtComponentPath,
        fileFolder: FileFolder.BuiltFrontComponent,
        isRequired: true,
      },
    );
  }

  const sharedDependencies =
    manifest.application.frontComponentSharedDependencies;

  if (isDefined(sharedDependencies)) {
    files.push({
      relativePath: sharedDependencies.builtPath,
      fileFolder: FileFolder.BuiltFrontComponent,
      isRequired: true,
    });
  }

  for (const publicAsset of manifest.publicAssets ?? []) {
    files.push({
      relativePath: publicAsset.filePath,
      fileFolder: FileFolder.PublicAsset,
      isRequired: true,
    });
  }

  return files;
};
