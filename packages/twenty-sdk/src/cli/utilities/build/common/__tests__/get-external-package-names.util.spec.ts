import { describe, expect, it } from 'vitest';

import { getExternalPackageNames } from '@/cli/utilities/build/common/get-external-package-names.util';

const buildMetafile = (
  imports: { path: string; external?: boolean }[],
): { outputs: Record<string, { imports: typeof imports }> } => ({
  outputs: {
    'src/logic-functions/send.mjs': { imports },
  },
});

describe('getExternalPackageNames', () => {
  it('should report a package the bundle leaves for run time', () => {
    const externalPackageNames = getExternalPackageNames(
      buildMetafile([
        { path: 'twenty-client-sdk/core', external: true },
        { path: 'twenty-client-sdk/metadata', external: true },
      ]),
    );

    expect([...externalPackageNames]).toEqual(['twenty-client-sdk']);
  });

  it('should report an external third-party package by its root name', () => {
    const externalPackageNames = getExternalPackageNames(
      buildMetafile([{ path: '@scope/pkg/sub-path', external: true }]),
    );

    expect([...externalPackageNames]).toEqual(['@scope/pkg']);
  });

  it('should ignore host builtins and inlined imports', () => {
    const externalPackageNames = getExternalPackageNames(
      buildMetafile([
        { path: 'crypto', external: true },
        { path: 'node:crypto', external: true },
        { path: './inlined.js', external: false },
      ]),
    );

    expect([...externalPackageNames]).toEqual([]);
  });

  it('should report nothing when the build produced no metafile', () => {
    expect([...getExternalPackageNames(undefined)]).toEqual([]);
  });
});
