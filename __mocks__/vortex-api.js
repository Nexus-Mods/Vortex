const path = require('path');

// Always require from source, never from packaged artifacts
// Mock the vortex-api module with essential functionality
module.exports = {
  // Add commonly used utilities and functions
  util: {
    // Basic file system operations
    fs: {
      ensureDirAsync: jest.fn().mockResolvedValue(undefined),
      removeAsync: jest.fn().mockResolvedValue(undefined),
      statAsync: jest.fn().mockResolvedValue({ size: 1000 }),
      readdirAsync: jest.fn().mockResolvedValue([]),
      copyAsync: jest.fn().mockResolvedValue(undefined),
      moveAsync: jest.fn().mockResolvedValue(undefined),
    },
    // Promise helpers
    Promise: Promise,
    // Logging utilities
    log: jest.fn(),
  },
  // Add other necessary exports as needed
  actions: {},
  types: {},
  selectors: {},
};