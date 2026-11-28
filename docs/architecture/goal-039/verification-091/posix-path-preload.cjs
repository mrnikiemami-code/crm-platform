// Verification harness only: force path.relative results to POSIX separators
// so twenty-sdk@2.35.0 apply on Windows matches server validation.
const path = require('node:path');
const originalRelative = path.relative.bind(path);
path.relative = (...args) => originalRelative(...args).split(path.sep).join('/');
