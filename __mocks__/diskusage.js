'use strict';

// Default mock values for disk usage (500GB total, 100GB free)
const checkResult = {
  '': {
    available: 107374182400,  // 100GB in bytes
    free: 107374182400,      // 100GB in bytes
    total: 536870912000,     // 500GB in bytes
  },
  // Low disk space for /driveb to trigger insufficient space error
  '/driveb': {
    available: 100000000,    // 100MB in bytes (less than 512MB required)
    free: 100000000,        // 100MB in bytes
    total: 536870912000,    // 500GB in bytes
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
    let result = checkResult[normalizedPath] || checkResult[''];
    
    // Special handling for /driveb and its parent directory to trigger insufficient space error
    if (normalizedPath === '/driveb' || normalizedPath.includes('/driveb')) {
      result = checkResult['/driveb'];
    }
    
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
