'use strict';

module.exports = {
  check: () => Promise.resolve(true),
  request: () => Promise.resolve(true),
  requireAdmin: () => false,
  getFileOwner: () => Promise.resolve('current_user'),
  setFileOwner: () => Promise.resolve(),
  getFilePermissions: () => Promise.resolve('rwx------'),
  setFilePermissions: () => Promise.resolve()
};