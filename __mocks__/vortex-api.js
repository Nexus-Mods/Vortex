const path = require('path');
const crypto = require('crypto');

// We need to mock the util object with storeHelper functions
const storeHelper = require('../src/util/storeHelper');

// Mock genMd5Hash function
function genMd5Hash(filePath, progressFunc) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    
    const hash = crypto.createHash('md5');
    const stats = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    let totalBytes = 0;
    
    stream.on('data', (chunk) => {
      hash.update(chunk);
      totalBytes += chunk.length;
      if (progressFunc) {
        progressFunc(totalBytes, stats.size);
      }
    });
    
    stream.on('end', () => {
      resolve({
        md5sum: hash.digest('hex'),
        numBytes: stats.size
      });
    });
    
    stream.on('error', reject);
  });
}

// Mock the entire vortex-api module
const vortexApi = {
  util: {
    setSafe: storeHelper.setSafe,
    deleteOrNop: storeHelper.deleteOrNop,
    // Add other commonly used util functions
    getSafe: storeHelper.getSafe,
    removeValue: storeHelper.removeValue,
    pushSafe: storeHelper.pushSafe,
    merge: storeHelper.merge,
    setOrNop: storeHelper.setOrNop,
    updateOrNop: storeHelper.updateOrNop,
    // Add other util functions as needed from util/api.ts
    batchDispatch: () => {},
    bytesToString: (bytes) => `${bytes} bytes`,
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    makeQueue: () => ({ push: () => {}, length: 0 }),
    toPromise: (value) => Promise.resolve(value),
    unique: (arr) => [...new Set(arr)],
    // Mock some commonly used utilities
    sanitizeFilename: (name) => name.replace(/[<>:"/\\|?*]/g, '_'),
    isChildPath: () => false,
    isFilenameValid: () => true,
    isPathValid: () => true,
  },
  // Add other parts of the API as needed
  actions: {},
  types: {},
  fs: {
    writeFileAtomic: async () => {},
    copyFileAtomic: async () => {},
  },
  log: (level, message, meta) => console.log(`[${level}] ${message}`, meta || ''),
  selectors: {},
  // Add the genMd5Hash function to the main API
  genMd5Hash,
};

module.exports = vortexApi;
