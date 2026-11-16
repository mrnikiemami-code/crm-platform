import { promises as fs } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { LocalLayerManagerService } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/services/local-layer-manager.service';
import { LAYER_BUILD_READY_SENTINEL } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/constants/local-driver.constant';
import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';

const mockCopyYarnEngineAndBuildDependencies = jest.fn();
let mockDepsLayerPath = '';

jest.mock(
  'src/engine/core-modules/application/application-package/utils/copy-yarn-engine-and-build-dependencies',
  () => ({
    copyYarnEngineAndBuildDependencies: (...args: unknown[]) =>
      mockCopyYarnEngineAndBuildDependencies(...args),
  }),
);

jest.mock(
  'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/utils/get-local-deps-layer-path.util',
  () => ({
    getLocalDepsLayerPath: () => mockDepsLayerPath,
  }),
);

const buildService = ({
  packageJson,
  hasYarnLock,
}: {
  packageJson: string;
  hasYarnLock: boolean;
}) => {
  const logicFunctionResourceService = {
    copyDependenciesInMemory: jest.fn(async ({ inMemoryFolderPath }) => {
      await fs.mkdir(inMemoryFolderPath, { recursive: true });
      await fs.writeFile(
        join(inMemoryFolderPath, 'package.json'),
        packageJson,
        'utf-8',
      );

      return { hasYarnLock };
    }),
  };

  const service = new LocalLayerManagerService(
    { withLock: (callback: () => Promise<void>) => callback() } as never,
    logicFunctionResourceService as never,
    {} as never,
    {} as never,
  );

  return { service, logicFunctionResourceService };
};

const flatApplication = {
  id: 'app-id',
  workspaceId: 'workspace-id',
  yarnLockChecksum: 'checksum',
} as unknown as FlatApplication;

describe('LocalLayerManagerService.ensureDepsLayer', () => {
  beforeEach(async () => {
    mockDepsLayerPath = await mkdtemp(join(tmpdir(), 'deps-layer-'));
    mockCopyYarnEngineAndBuildDependencies.mockReset();
  });

  afterEach(async () => {
    await rm(mockDepsLayerPath, { recursive: true, force: true });
  });

  it('should build a dependency-free layer without running yarn', async () => {
    const { service } = buildService({
      packageJson: JSON.stringify({ dependencies: {} }),
      hasYarnLock: true,
    });

    await service.ensureDepsLayer({
      flatApplication,
      applicationUniversalIdentifier: 'universal-identifier',
    });

    expect(mockCopyYarnEngineAndBuildDependencies).not.toHaveBeenCalled();
    expect(
      await fs.stat(join(mockDepsLayerPath, 'node_modules')),
    ).toBeDefined();
    expect(
      await fs.stat(join(mockDepsLayerPath, LAYER_BUILD_READY_SENTINEL)),
    ).toBeDefined();
  });

  it('should refuse to install runtime dependencies without a lockfile', async () => {
    const { service } = buildService({
      packageJson: JSON.stringify({
        dependencies: { 'some-package': '^1.0.0' },
      }),
      hasYarnLock: false,
    });

    await expect(
      service.ensureDepsLayer({
        flatApplication,
        applicationUniversalIdentifier: 'universal-identifier',
      }),
    ).rejects.toThrow(/ships no yarn\.lock/);

    expect(mockCopyYarnEngineAndBuildDependencies).not.toHaveBeenCalled();
    await expect(
      fs.stat(join(mockDepsLayerPath, LAYER_BUILD_READY_SENTINEL)),
    ).rejects.toThrow();
  });

  it('should install through yarn when a lockfile backs the dependencies', async () => {
    const { service } = buildService({
      packageJson: JSON.stringify({
        dependencies: { 'some-package': '^1.0.0' },
      }),
      hasYarnLock: true,
    });

    await service.ensureDepsLayer({
      flatApplication,
      applicationUniversalIdentifier: 'universal-identifier',
    });

    expect(mockCopyYarnEngineAndBuildDependencies).toHaveBeenCalledTimes(1);
  });

  it('should refuse to build a layer when the package manifest is missing', async () => {
    await fs.mkdir(mockDepsLayerPath, { recursive: true });

    const service = new LocalLayerManagerService(
      { withLock: (callback: () => Promise<void>) => callback() } as never,
      {
        copyDependenciesInMemory: jest.fn(async () => ({ hasYarnLock: false })),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.ensureDepsLayer({
        flatApplication,
        applicationUniversalIdentifier: 'universal-identifier',
      }),
    ).rejects.toThrow();

    await expect(
      fs.stat(join(mockDepsLayerPath, LAYER_BUILD_READY_SENTINEL)),
    ).rejects.toThrow();
  });

  it('should not treat a sentinel without node_modules as a ready layer', async () => {
    await fs.writeFile(join(mockDepsLayerPath, LAYER_BUILD_READY_SENTINEL), '');

    const { service, logicFunctionResourceService } = buildService({
      packageJson: JSON.stringify({ dependencies: {} }),
      hasYarnLock: true,
    });

    await service.ensureDepsLayer({
      flatApplication,
      applicationUniversalIdentifier: 'universal-identifier',
    });

    expect(
      logicFunctionResourceService.copyDependenciesInMemory,
    ).toHaveBeenCalled();
    expect(
      await fs.stat(join(mockDepsLayerPath, 'node_modules')),
    ).toBeDefined();
  });

  it('should reuse a layer that already holds node_modules', async () => {
    await fs.mkdir(join(mockDepsLayerPath, 'node_modules'), {
      recursive: true,
    });
    await fs.writeFile(join(mockDepsLayerPath, LAYER_BUILD_READY_SENTINEL), '');

    const { service, logicFunctionResourceService } = buildService({
      packageJson: JSON.stringify({ dependencies: {} }),
      hasYarnLock: true,
    });

    await service.ensureDepsLayer({
      flatApplication,
      applicationUniversalIdentifier: 'universal-identifier',
    });

    expect(
      logicFunctionResourceService.copyDependenciesInMemory,
    ).not.toHaveBeenCalled();
  });
});
