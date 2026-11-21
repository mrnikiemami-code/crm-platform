// Preload for the Twenty SDK CLI on Windows.
//
// The SDK builds front-component resource paths with `path.relative`, which yields
// backslashes on Windows; manifest validation then rejects every component with
// INVALID_FRONT_COMPONENT_INPUT. Forcing forward slashes at the source keeps `plan` and
// `apply` usable without touching the published SDK.
//
// Usage: node -r ./scripts/windows-path-preload.cjs ./node_modules/twenty-sdk/dist/cli.cjs plan -r <remote>
const path = require('node:path');

const originalRelative = path.relative;
const originalJoin = path.join;

path.relative = (...args) => originalRelative(...args).split(path.sep).join('/');
path.join = (...args) =>
  originalJoin(...args).split(path.win32.sep).join('/');
