import crypto from 'crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'path';
import {
  NODE_ESM_CJS_BANNER,
  OUTPUT_DIR,
  type Manifest,
} from 'twenty-shared/application';
import { FileFolder } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { copyReadmeToOutput } from '@/cli/utilities/build/common/copy-readme-to-output';
import { type GeneratedAsset } from '@/cli/utilities/build/cover/generated-asset.type';
import { esbuildOneShotBuild } from '@/cli/utilities/build/common/esbuild-one-shot-build';
import { LOGIC_FUNCTION_EXTERNAL_MODULES } from '@/cli/utilities/build/common/esbuild-watcher';
import { getBaseFrontComponentBuildOptions } from '@/cli/utilities/build/common/front-component-build/utils/get-base-front-component-build-options';
import { getFrontComponentBuildPlugins } from '@/cli/utilities/build/common/front-component-build/utils/get-front-component-build-plugins';
import { createStubTwentySdkDefinePlugin } from '@/cli/utilities/build/common/plugins/stub-twenty-sdk-define.plugin';
import { getExternalPackageNames } from '@/cli/utilities/build/common/get-external-package-names.util';
import { resolveRuntimeDependencies } from '@/cli/utilities/build/common/resolve-runtime-dependencies.util';
import { type OnFileBuiltCallback } from '@/cli/utilities/build/common/restartable-watcher-interface';
import { buildSharedDependenciesBundle } from '@/cli/utilities/build/common/front-component-build/shared-dependencies-build/build-shared-dependencies-bundle';
import { type SharedDependenciesBuildContext } from '@/cli/utilities/build/common/front-component-build/shared-dependencies-build/types/shared-dependencies-build-context.type';
import { type EntityFilePaths } from '@/cli/utilities/build/manifest/manifest-extract-config';
import { SHIPPED_YARN_LOCK_RELATIVE_PATH } from '@/cli/utilities/build/manifest/manifest-update-checksums';
import { loadFrontComponentTranslationCatalogs } from '@/cli/utilities/translations/load-front-component-translation-catalogs';
import {
  copy,
  emptyDir,
  ensureDir,
  pathExists,
} from '@/cli/utilities/file/fs-utils';
import { FRONT_COMPONENT_TRANSLATIONS_KEY } from '@/sdk/front-component/constants/front-component-translations-key';

export type AppBuildOptions = {
  appPath: string;
  manifest: Manifest;
  filePaths: EntityFilePaths;
  generatedAssets?: GeneratedAsset[];
};

export type BuiltFileInfo = {
  checksum: string;
  builtPath: string;
  sourcePath: string;
  fileFolder: FileFolder;
  usesSdkClient?: boolean;
};

export type AppBuildResult = {
  builtFileInfos: Map<string, BuiltFileInfo>;
};

export const buildApplication = async (
  options: AppBuildOptions,
): Promise<AppBuildResult> => {
  const outputDir = join(options.appPath, OUTPUT_DIR);

  await ensureDir(outputDir);
  await emptyDir(outputDir);

  const builtFileInfos = new Map<string, BuiltFileInfo>();

  const collectFileBuilt: OnFileBuiltCallback = (event) => {
    builtFileInfos.set(event.builtPath, {
      checksum: event.checksum,
      builtPath: event.builtPath,
      sourcePath: event.sourcePath,
      fileFolder: event.fileFolder,
      usesSdkClient: event.usesSdkClient,
    });
  };

  const { logicFunctions, frontComponents } = options.filePaths;
  const sharedDependencies =
    options.manifest.application.frontComponentSharedDependencies;

  // Bake the app's compiled translation catalogs into every front-component
  // bundle so the runtime t()/<Trans> resolves them in the sandboxed worker
  // without a server round-trip. Omitted entirely when the app has no
  // translations, leaving the runtime to fall back to source strings.
  const frontComponentTranslationCatalogs =
    await loadFrontComponentTranslationCatalogs(options.appPath);

  const frontComponentTranslationsBanner = Object.keys(
    frontComponentTranslationCatalogs,
  ).length
    ? {
        js: `globalThis[${JSON.stringify(FRONT_COMPONENT_TRANSLATIONS_KEY)}]=${JSON.stringify(
          frontComponentTranslationCatalogs,
        )};`,
      }
    : undefined;

  const logicFunctionMetafile = await esbuildOneShotBuild({
    appPath: options.appPath,
    sourcePaths: logicFunctions,
    fileFolder: FileFolder.BuiltLogicFunction,
    buildOptions: {
      bundle: true,
      splitting: false,
      format: 'esm',
      platform: 'node',
      outdir: join(options.appPath, OUTPUT_DIR),
      outExtension: { '.js': '.mjs' },
      external: LOGIC_FUNCTION_EXTERNAL_MODULES,
      tsconfig: join(options.appPath, 'tsconfig.json'),
      sourcemap: true,
      metafile: true,
      logLevel: 'silent',
      banner: NODE_ESM_CJS_BANNER,
      plugins: [createStubTwentySdkDefinePlugin()],
    },
    onFileBuilt: collectFileBuilt,
  });

  const sharedDependenciesBuildContext: SharedDependenciesBuildContext | null =
    isDefined(sharedDependencies)
      ? await buildSharedDependenciesBundle({
          appPath: options.appPath,
          sharedDependencies,
          onFileBuilt: collectFileBuilt,
        })
      : null;

  await esbuildOneShotBuild({
    appPath: options.appPath,
    sourcePaths: frontComponents,
    fileFolder: FileFolder.BuiltFrontComponent,
    buildOptions: {
      ...getBaseFrontComponentBuildOptions(),
      outdir: join(options.appPath, OUTPUT_DIR),
      tsconfig: join(options.appPath, 'tsconfig.json'),
      jsx: 'automatic',
      sourcemap: true,
      metafile: true,
      logLevel: 'silent',
      ...(frontComponentTranslationsBanner !== undefined
        ? { banner: frontComponentTranslationsBanner }
        : {}),
      plugins: [
        ...getFrontComponentBuildPlugins({
          getSharedDependenciesBuildContext: () =>
            sharedDependenciesBuildContext,
        }),
        createStubTwentySdkDefinePlugin(),
      ],
    },
    onFileBuilt: collectFileBuilt,
  });

  await copyStaticFiles({
    appPath: options.appPath,
    fileFolder: FileFolder.Source,
    filePaths: [...new Set([...logicFunctions, ...frontComponents])],
    collectFileBuilt,
  });

  await copyStaticFiles({
    appPath: options.appPath,
    fileFolder: FileFolder.PublicAsset,
    filePaths: options.filePaths.publicAssets,
    collectFileBuilt,
  });

  await writeRuntimeDependencies({
    appPath: options.appPath,
    externalPackageNames: getExternalPackageNames(
      logicFunctionMetafile ?? undefined,
    ),
    collectFileBuilt,
  });

  for (const generatedAsset of options.generatedAssets ?? []) {
    await writeGeneratedAsset({
      appPath: options.appPath,
      generatedAsset,
      collectFileBuilt,
    });
  }

  await copyReadmeToOutput(options.appPath);

  return { builtFileInfos };
};

const writeRuntimeDependencies = async ({
  appPath,
  externalPackageNames,
  collectFileBuilt,
}: {
  appPath: string;
  externalPackageNames: ReadonlySet<string>;
  collectFileBuilt: OnFileBuiltCallback;
}) => {
  const sourcePackageJsonPath = join(appPath, 'package.json');

  const sourcePackageJsonContent = await readFile(
    sourcePackageJsonPath,
    'utf-8',
  );
  const sourcePackageJson = JSON.parse(sourcePackageJsonContent) as {
    dependencies?: Record<string, string>;
  };

  const { dependencies } = resolveRuntimeDependencies({
    dependencies: sourcePackageJson.dependencies,
    externalPackageNames,
  });

  // A runtime dependency the bundle does not contain can only be satisfied by a
  // registry install, so it must stay declared. Everything else was inlined by
  // esbuild and would only buy a network round-trip for code we already ship.
  const runtimePackageJsonContent = `${JSON.stringify(
    { ...sourcePackageJson, dependencies },
    null,
    2,
  )}\n`;

  const builtPackageJsonPath = join(OUTPUT_DIR, 'package.json');

  await writeFile(
    join(appPath, builtPackageJsonPath),
    runtimePackageJsonContent,
  );
  collectFileBuilt({
    fileFolder: FileFolder.Dependencies,
    builtPath: builtPackageJsonPath,
    sourcePath: 'package.json',
    checksum: crypto
      .createHash('md5')
      .update(runtimePackageJsonContent)
      .digest('hex'),
  });

  const yarnLockPath = join(appPath, 'yarn.lock');

  if (!(await pathExists(yarnLockPath))) {
    return;
  }

  const yarnLockContent = await readFile(yarnLockPath);
  const yarnLockChecksum = crypto
    .createHash('md5')
    .update(yarnLockContent)
    .digest('hex');

  // `npm pack` drops a root-level lockfile unconditionally, and the installer
  // reads its copy back from the tarball, so the shipped copy lives under
  // dependencies/ where the packer leaves it alone.
  const shippedYarnLockPath = join(OUTPUT_DIR, SHIPPED_YARN_LOCK_RELATIVE_PATH);

  await ensureDir(dirname(join(appPath, shippedYarnLockPath)));
  await writeFile(join(appPath, shippedYarnLockPath), yarnLockContent);
  collectFileBuilt({
    fileFolder: FileFolder.Dependencies,
    builtPath: shippedYarnLockPath,
    sourcePath: 'yarn.lock',
    checksum: yarnLockChecksum,
  });
};

const writeGeneratedAsset = async ({
  appPath,
  generatedAsset,
  collectFileBuilt,
}: {
  appPath: string;
  generatedAsset: GeneratedAsset;
  collectFileBuilt: OnFileBuiltCallback;
}) => {
  const builtPath = join(OUTPUT_DIR, generatedAsset.relativePath);
  const absoluteBuiltPath = join(appPath, builtPath);

  await ensureDir(dirname(absoluteBuiltPath));
  await writeFile(absoluteBuiltPath, generatedAsset.content);

  const checksum = crypto
    .createHash('md5')
    .update(generatedAsset.content)
    .digest('hex');

  collectFileBuilt({
    fileFolder: FileFolder.PublicAsset,
    builtPath,
    sourcePath: generatedAsset.relativePath,
    checksum,
  });
};

const copyStaticFiles = async ({
  appPath,
  fileFolder,
  filePaths,
  collectFileBuilt,
}: {
  appPath: string;
  fileFolder: FileFolder;
  filePaths: string[];
  collectFileBuilt: OnFileBuiltCallback;
}) => {
  for (const sourcePath of filePaths) {
    const absoluteSourcePath = join(appPath, sourcePath);

    if (!(await pathExists(absoluteSourcePath))) {
      continue;
    }

    const builtPath = join(OUTPUT_DIR, sourcePath);
    const absoluteBuiltPath = join(appPath, builtPath);

    await ensureDir(dirname(absoluteBuiltPath));
    await copy(absoluteSourcePath, absoluteBuiltPath);

    const content = await readFile(absoluteBuiltPath);
    const checksum = crypto.createHash('md5').update(content).digest('hex');

    collectFileBuilt({
      fileFolder,
      builtPath,
      sourcePath,
      checksum,
    });
  }
};
