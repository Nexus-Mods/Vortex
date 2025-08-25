// Mock implementation for vortexmt native module

function md5(input) {
  // Simple mock that returns a fixed hash
  return Buffer.from('0123456789abcdef0123456789abcdef');
}

function md5File(filePath, callback, progressCB) {
  // Mock implementation that simulates file hashing
  if (typeof callback !== 'function') {
    throw new Error('Expected two or three parameters (path, callback, progressCB?)');
  }

  // Simulate async operation
  process.nextTick(() => {
    callback(null, Buffer.from('0123456789abcdef0123456789abcdef'));
  });
}

module.exports = {
  md5,
  md5File,
};