import { BadRequestException } from '@nestjs/common';

import { FileFolder } from 'twenty-shared/types';

import { normalizeFileEntityPathToPosix } from 'src/engine/core-modules/file/utils/normalize-file-entity-path-to-posix.util';

export const removeFileFolderFromFileEntityPath = (path: string): string => {
  const normalizedPath = normalizeFileEntityPathToPosix(path);
  const [fileFolder, ...relativePathSegments] = normalizedPath.split('/');

  if (!Object.values(FileFolder).includes(fileFolder as FileFolder)) {
    throw new BadRequestException(`File folder ${fileFolder} is not allowed`);
  }

  return relativePathSegments.join('/');
};
