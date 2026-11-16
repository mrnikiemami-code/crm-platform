import { describe, expect, it } from 'vitest';

import { resolveRuntimeDependencies } from '@/cli/utilities/build/common/resolve-runtime-dependencies.util';

describe('resolveRuntimeDependencies', () => {
  it('should drop a dependency the bundle inlined', () => {
    const result = resolveRuntimeDependencies({
      dependencies: { '@sniptt/guards': '^0.2.0' },
      externalPackageNames: new Set(),
    });

    expect(result.dependencies).toEqual({});
    expect(result.removedDependencyNames).toEqual(['@sniptt/guards']);
  });

  it('should keep a dependency the bundle leaves external', () => {
    const result = resolveRuntimeDependencies({
      dependencies: { '@sniptt/guards': '^0.2.0', 'native-driver': '^1.0.0' },
      externalPackageNames: new Set(['native-driver']),
    });

    expect(result.dependencies).toEqual({ 'native-driver': '^1.0.0' });
    expect(result.removedDependencyNames).toEqual(['@sniptt/guards']);
  });

  it('should drop packages the executor provides itself', () => {
    const result = resolveRuntimeDependencies({
      dependencies: { 'twenty-client-sdk': '2.35.0', 'twenty-sdk': '2.35.0' },
      externalPackageNames: new Set(['twenty-client-sdk', 'twenty-sdk']),
    });

    expect(result.dependencies).toEqual({});
    expect(result.removedDependencyNames.sort()).toEqual([
      'twenty-client-sdk',
      'twenty-sdk',
    ]);
  });

  it('should treat a package without dependencies as dependency free', () => {
    expect(
      resolveRuntimeDependencies({
        dependencies: undefined,
        externalPackageNames: new Set(),
      }),
    ).toEqual({ dependencies: {}, removedDependencyNames: [] });
  });
});
