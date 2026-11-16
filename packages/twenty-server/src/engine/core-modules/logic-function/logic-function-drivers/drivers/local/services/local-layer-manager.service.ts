import { promises as fs } from 'fs';
import { join } from 'path';

import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import { copyYarnEngineAndBuildDependencies } from 'src/engine/core-modules/application/application-package/utils/copy-yarn-engine-and-build-dependencies';
import { type CacheLockService } from 'src/engine/core-modules/cache-lock/cache-lock.service';
import {
  LAYER_BUILD_LOCK_MAX_RETRIES,
  LAYER_BUILD_LOCK_RETRY_MS,
  LAYER_BUILD_LOCK_TTL_MS,
  LAYER_BUILD_READY_SENTINEL,
} from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/constants/local-driver.constant';
import { getLocalDepsLayerPath } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/utils/get-local-deps-layer-path.util';
import { getLocalSdkLayerPath } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/utils/get-local-sdk-layer-path.util';
import { hasPackageJsonRuntimeDependencies } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/utils/has-package-json-runtime-dependencies.util';
import { pathExists } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/utils/path-exists.util';
import { type LogicFunctionResourceService } from 'src/engine/core-modules/logic-function/logic-function-resource/logic-function-resource.service';
import { type SdkClientArchiveService } from 'src/engine/core-modules/sdk-client/sdk-client-archive.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import {
  LogicFunctionException,
  LogicFunctionExceptionCode,
} from 'src/engine/metadata-modules/logic-function/logic-function.exception';

type LayerAppContext = {
  flatApplication: FlatApplication;
  applicationUniversalIdentifier: string;
};

export class LocalLayerManagerService {
  constructor(
    private readonly cacheLockService: CacheLockService,
    private readonly logicFunctionResourceService: LogicFunctionResourceService,
    private readonly sdkClientArchiveService: SdkClientArchiveService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  private async isDepsLayerReady(depsLayerPath: string): Promise<boolean> {
    const depsReadySentinelPath = join(
      depsLayerPath,
      LAYER_BUILD_READY_SENTINEL,
    );
    const nodeModulesPath = join(depsLayerPath, 'node_modules');

    // The sentinel can outlive a pruned node_modules, and the executor cannot
    // resolve a runtime import without it, so readiness needs both.
    return (
      (await pathExists(depsReadySentinelPath)) &&
      (await pathExists(nodeModulesPath))
    );
  }

  async ensureDepsLayer({
    flatApplication,
    applicationUniversalIdentifier,
  }: LayerAppContext): Promise<void> {
    const depsLayerPath = getLocalDepsLayerPath(flatApplication);
    const depsReadySentinelPath = join(
      depsLayerPath,
      LAYER_BUILD_READY_SENTINEL,
    );

    if (await this.isDepsLayerReady(depsLayerPath)) {
      return;
    }

    const lockKey = `local-driver-deps-layer:${flatApplication.yarnLockChecksum ?? 'default'}`;

    await this.cacheLockService.withLock(
      async () => {
        if (await this.isDepsLayerReady(depsLayerPath)) {
          return;
        }

        await fs.rm(depsLayerPath, { recursive: true, force: true });

        const { hasYarnLock } =
          await this.logicFunctionResourceService.copyDependenciesInMemory({
            applicationUniversalIdentifier,
            workspaceId: flatApplication.workspaceId,
            inMemoryFolderPath: depsLayerPath,
          });

        const hasRuntimeDependencies = await hasPackageJsonRuntimeDependencies(
          join(depsLayerPath, 'package.json'),
        );

        if (hasRuntimeDependencies) {
          // Without the lockfile yarn would resolve versions on the fly, which
          // is both non-reproducible and a silent registry dependency.
          if (!hasYarnLock) {
            throw new LogicFunctionException(
              `Cannot build the dependency layer for application ${applicationUniversalIdentifier}: package.json declares runtime dependencies but the package ships no yarn.lock`,
              LogicFunctionExceptionCode.LOGIC_FUNCTION_LAYER_BUILD_FAILED,
            );
          }

          await copyYarnEngineAndBuildDependencies(depsLayerPath);
        } else {
          await fs.mkdir(join(depsLayerPath, 'node_modules'), {
            recursive: true,
          });
        }

        await fs.writeFile(depsReadySentinelPath, '');
      },
      lockKey,
      {
        ttl: LAYER_BUILD_LOCK_TTL_MS,
        ms: LAYER_BUILD_LOCK_RETRY_MS,
        maxRetries: LAYER_BUILD_LOCK_MAX_RETRIES,
      },
    );
  }

  async ensureSdkLayer({
    flatApplication,
    applicationUniversalIdentifier,
  }: LayerAppContext): Promise<void> {
    const sdkLayerPath = getLocalSdkLayerPath({
      workspaceId: flatApplication.workspaceId,
      applicationUniversalIdentifier,
    });
    const sdkNodeModulesPath = join(sdkLayerPath, 'node_modules');
    const sdkReadySentinelPath = join(sdkLayerPath, LAYER_BUILD_READY_SENTINEL);

    if (
      (await pathExists(sdkReadySentinelPath)) &&
      !flatApplication.isSdkLayerStale
    ) {
      return;
    }

    const lockKey = `local-driver-sdk-layer:${flatApplication.workspaceId}:${applicationUniversalIdentifier}`;

    await this.cacheLockService.withLock(
      async () => {
        const { flatApplicationMaps } =
          await this.workspaceCacheService.getOrRecompute(
            flatApplication.workspaceId,
            ['flatApplicationMaps'],
          );
        const freshFlatApplication =
          flatApplicationMaps.byId[flatApplication.id];
        const isStale = freshFlatApplication?.isSdkLayerStale ?? true;

        if ((await pathExists(sdkReadySentinelPath)) && !isStale) {
          return;
        }

        await fs.rm(sdkLayerPath, { recursive: true, force: true });

        const sdkPackagePath = join(sdkNodeModulesPath, 'twenty-client-sdk');

        await this.sdkClientArchiveService.downloadAndExtractToPackage({
          workspaceId: flatApplication.workspaceId,
          applicationId: flatApplication.id,
          applicationUniversalIdentifier,
          targetPackagePath: sdkPackagePath,
        });

        await this.sdkClientArchiveService.markSdkLayerFresh({
          applicationId: flatApplication.id,
          workspaceId: flatApplication.workspaceId,
        });

        await fs.writeFile(sdkReadySentinelPath, '');
      },
      lockKey,
      {
        ttl: LAYER_BUILD_LOCK_TTL_MS,
        ms: LAYER_BUILD_LOCK_RETRY_MS,
        maxRetries: LAYER_BUILD_LOCK_MAX_RETRIES,
      },
    );
  }
}
