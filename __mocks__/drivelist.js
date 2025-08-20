'use strict';

// Mock implementation of drivelist for macOS
const mockDriveInfo = [{
  blockSize: 512,
  blocks: 976773168,
  busType: 'SATA',
  description: 'Mock Drive',
  device: '/dev/disk0',
  displayName: 'Mock Drive',
  enumerator: 'STORAGE',
  error: null,
  isReadOnly: false,
  isRemovable: false,
  isSystem: true,
  logicalBlockSize: 512,
  mountpoints: [{
    path: '/',
    label: 'Macintosh HD'
  }],
  raw: '/dev/rdisk0',
  size: 500107862016,
  devicePath: '/dev/disk0',
  isUSB: false,
  isUAS: false
}];

module.exports = {
  // Mock the list method to support both callback and Promise styles
  list: (callback) => {
    if (typeof callback === 'function') {
      process.nextTick(() => callback(null, mockDriveInfo));
      return undefined;
    }
    return Promise.resolve(mockDriveInfo);
  },

  // Mock the listAsync method (alternative API)
  listAsync: () => Promise.resolve(mockDriveInfo)
};