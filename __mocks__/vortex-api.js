/* eslint-env jest */
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
    // State manipulation utilities
    deleteOrNop: (state, path) => {
      const result = { ...state };
      const keys = Array.isArray(path) ? path : [path];
      let current = result;
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) {
          return state;
        }
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      if (current[keys[keys.length - 1]] !== undefined) {
        delete current[keys[keys.length - 1]];
      }
      return result;
    },
    setSafe: (state, path, value) => {
      const result = { ...state };
      const keys = Array.isArray(path) ? path : [path];
      let current = result;
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) {
          current[keys[i]] = {};
        } else {
          current[keys[i]] = { ...current[keys[i]] };
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return result;
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