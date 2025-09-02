'use strict';

// Mock implementation of xxhash-addon for macOS
module.exports = {
  XXHash64: class {
    constructor() {
      // Mock constructor
    }

    update(data) {
      // Mock update method
      return this;
    }

    digest() {
      // Return a mock hash as Buffer to match expected type
      return Buffer.from('mockhash12345678', 'hex');
    }
  },
};