'use strict';

// Mock implementation of fomod-installer for macOS
module.exports = {
  // Mock the install function
  install: (sourcePath, destinationPath, options) => {
    // Return a mock success response
    return Promise.resolve({
      success: true,
      error: null,
      sourcePath: sourcePath,
      destinationPath: destinationPath
    });
  },

  // Mock the parse function
  parse: (fomodPath) => {
    // Return a mock fomod structure
    return Promise.resolve({
      name: 'Mock FOMOD',
      author: 'Mock Author',
      version: '1.0.0',
      steps: [],
      requiredFiles: []
    });
  }
};