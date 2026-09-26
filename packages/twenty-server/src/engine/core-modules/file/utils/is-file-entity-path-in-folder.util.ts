import { type FileFolder } from 'twenty-shared/types';

import { normalizeFileEntityPathToPosix } from 'src/engine/core-modules/file/utils/normalize-file-entity-path-to-posix.util';

export const isFileEntityPathInFolder = ({
  path,
  fileFolder,
}: {
  path: string;
  fileFolder: FileFolder;
}): boolean => {
  const normalizedPath = normalizeFileEntityPathToPosix(path);

  return (
    normalizedPath === fileFolder ||
    normalizedPath.startsWith(`${fileFolder}/`)
  );
};
