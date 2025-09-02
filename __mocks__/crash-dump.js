'use strict';

// Mock implementation of crash-dump for macOS
const crashDumpMock = {
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

// Export both as default and named export for compatibility
module.exports = crashDumpMock;
module.exports.default = crashDumpMock;