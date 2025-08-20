'use strict';

// Default mock values for disk usage (500GB total, 100GB free)
let checkResult = {
  '': {
    available: 107374182400,  // 100GB in bytes
    free: 107374182400,      // 100GB in bytes
    total: 536870912000,     // 500GB in bytes
  },
};

// Normalize path separators for consistent lookup
const normalizePath = (path) => {
  return path.replace(/\\/g, '/').replace(/\/$/, '');
};

module.exports = {
  // Support both callback and Promise styles
  check: (path, callback) => {
    const normalizedPath = normalizePath(path);
    const result = checkResult[normalizedPath] || checkResult[''];
    
    if (typeof callback === 'function') {
      process.nextTick(() => callback(null, result));
      return undefined;
    }
    return Promise.resolve(result);
  },

  // Promise-based API
  checkSync: (path) => {
    const normalizedPath = normalizePath(path);
    return checkResult[normalizedPath] || checkResult[''];
  },

  // For testing: allow setting custom results
  __setCheckResult: (path, res) => {
    const normalizedPath = normalizePath(path);
    checkResult[normalizedPath] = res;
  },
};
