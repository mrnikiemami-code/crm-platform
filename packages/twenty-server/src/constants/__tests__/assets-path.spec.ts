import path from 'path';

import {
  ASSET_PATH,
  isBuiltThroughTestingModule,
  resolveAssetPath,
} from 'src/constants/assets-path';

// Host-independent normalization: both separators are folded to `/` so a
// Windows-style string is still comparable when the suite runs on POSIX.
const toPosix = (filePath: string): string => filePath.replace(/[\\/]/g, '/');

// Host-native absolute directories built from real-looking segments, so
// `path.resolve` behaves exactly as it would for a real build/source tree on
// whichever platform the suite runs on.
const nativeDir = (...segments: string[]): string =>
  path.resolve(path.parse(process.cwd()).root, ...segments);

const NATIVE_BUILT_DIR = nativeDir(
  'app',
  'packages',
  'twenty-server',
  'dist',
  'constants',
);
const NATIVE_SOURCE_DIR = nativeDir(
  'app',
  'packages',
  'twenty-server',
  'src',
  'constants',
);

describe('assets-path', () => {
  describe('isBuiltThroughTestingModule', () => {
    // Pure string inspection: these inputs are literal path strings, not
    // host-resolved paths, so they are meaningful on every platform.
    it('detects a dist build written with POSIX separators', () => {
      expect(
        isBuiltThroughTestingModule(
          '/app/packages/twenty-server/dist/constants',
        ),
      ).toBe(false);
    });

    it('detects a dist build written with Windows separators', () => {
      expect(
        isBuiltThroughTestingModule(
          'D:\\CrmSource\\twenty\\packages\\twenty-server\\dist\\constants',
        ),
      ).toBe(false);
    });

    it('treats a source path as not built (POSIX separators)', () => {
      expect(
        isBuiltThroughTestingModule(
          '/app/packages/twenty-server/src/constants',
        ),
      ).toBe(true);
    });

    it('treats a source path as not built (Windows separators)', () => {
      expect(
        isBuiltThroughTestingModule(
          'D:\\CrmSource\\twenty\\packages\\twenty-server\\src\\constants',
        ),
      ).toBe(true);
    });

    it('ignores a trailing folder merely named "dist" without a closing slash', () => {
      expect(
        isBuiltThroughTestingModule(
          '/app/packages/twenty-server/src/constants/dist',
        ),
      ).toBe(true);
    });

    it('does not treat a folder whose name contains "dist" as a build path', () => {
      expect(
        isBuiltThroughTestingModule(
          '/app/packages/twenty-server/src/distribution/constants',
        ),
      ).toBe(true);
    });

    it('detects the build marker in the middle of the path', () => {
      expect(
        isBuiltThroughTestingModule('/app/packages/twenty-server/dist/engine'),
      ).toBe(false);
    });
  });

  describe('resolveAssetPath', () => {
    // Only host-native paths are passed to `path.resolve`: a Windows-style
    // string would be interpreted as a single filename on POSIX and vice versa,
    // which would assert the host platform instead of the module's logic.
    it('appends the assets segment for a built tree', () => {
      const resolved = resolveAssetPath(NATIVE_BUILT_DIR);

      expect(resolved).toBe(path.resolve(NATIVE_BUILT_DIR, '../assets'));
      expect(path.basename(resolved)).toBe('assets');
      expect(path.basename(path.dirname(resolved))).toBe('dist');
    });

    it('resolves to the parent directory for a source tree', () => {
      const resolved = resolveAssetPath(NATIVE_SOURCE_DIR);

      expect(resolved).toBe(path.resolve(NATIVE_SOURCE_DIR, '..'));
      expect(path.basename(resolved)).toBe('src');
      expect(path.basename(resolved)).not.toBe('assets');
    });

    it('produces different results for the built and source trees', () => {
      expect(resolveAssetPath(NATIVE_BUILT_DIR)).not.toBe(
        resolveAssetPath(NATIVE_SOURCE_DIR),
      );
    });

    it('adds exactly one path segment in the built case', () => {
      const built = resolveAssetPath(NATIVE_BUILT_DIR).split(path.sep);
      const source = resolveAssetPath(NATIVE_SOURCE_DIR).split(path.sep);

      // Both inputs sit at the same depth (.../twenty-server/{dist|src}/constants);
      // the built result gains the extra `assets` segment.
      expect(built).toHaveLength(source.length + 1);
      expect(built[built.length - 1]).toBe('assets');
    });
  });

  describe('ASSET_PATH (module-level export)', () => {
    it('is consistent with resolveAssetPath for the module own directory', () => {
      const moduleDirectory = path.dirname(
        require.resolve('src/constants/assets-path'),
      );

      expect(ASSET_PATH).toBe(resolveAssetPath(moduleDirectory));
    });

    it('has the shape implied by the directory it was evaluated in', () => {
      const moduleDirectory = path.dirname(
        require.resolve('src/constants/assets-path'),
      );
      const isBuilt = !isBuiltThroughTestingModule(moduleDirectory);

      expect(path.basename(ASSET_PATH)).toBe(isBuilt ? 'assets' : 'src');
    });

    it('does not resolve inside the test directory', () => {
      expect(toPosix(ASSET_PATH)).not.toContain('/__tests__');
    });
  });
});
