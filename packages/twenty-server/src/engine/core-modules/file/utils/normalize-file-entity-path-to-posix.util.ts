export const normalizeFileEntityPathToPosix = (path: string): string =>
  path.replace(/\\/g, '/').replace(/\/+/g, '/');
