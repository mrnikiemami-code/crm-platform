import { FileFolder } from 'twenty-shared/types';

import { isFileEntityPathInFolder } from 'src/engine/core-modules/file/utils/is-file-entity-path-in-folder.util';

describe('isFileEntityPathInFolder', () => {
  it('should match posix paths', () => {
    expect(
      isFileEntityPathInFolder({
        path: `${FileFolder.CorePicture}/avatar.png`,
        fileFolder: FileFolder.CorePicture,
      }),
    ).toBe(true);
  });

  it('should match Windows backslash paths', () => {
    expect(
      isFileEntityPathInFolder({
        path: `${FileFolder.CorePicture}\\avatar.png`,
        fileFolder: FileFolder.CorePicture,
      }),
    ).toBe(true);
  });

  it('should reject paths from another folder', () => {
    expect(
      isFileEntityPathInFolder({
        path: `${FileFolder.FilesField}/doc.pdf`,
        fileFolder: FileFolder.CorePicture,
      }),
    ).toBe(false);
  });
});
