'use strict';

// Mock implementation of crash-dump for macOS
module.exports = {
  // Mock the initialize function
  initialize: () => {
    // No-op implementation for macOS
    return Promise.resolve();
  },

  // Mock the writeMemoryDump function
  writeMemoryDump: (processId, dumpPath, dumpType) => {
    // Return a mock success response
    return Promise.resolve({
      success: true,
      error: null,
      dumpPath: dumpPath,
    });
  },

  // Mock dump types
  DumpType: {
    MiniDump: 0,
    MidDump: 1,
    FullDump: 2,
  },
};