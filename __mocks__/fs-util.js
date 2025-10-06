/**
 * Mock for src/util/fs.ts
 * Uses jest.requireActual to load the real fs.ts but wraps problematic methods
 */

// Mock original-fs to prevent electron dependency issues
jest.mock('original-fs', () => {
  const fs = require('fs');
  return {
    ...fs,
    readFileSync: (...args) => {
      try {
        return fs.readFileSync(...args);
      } catch (err) {
        if (err.code === 'ENOENT') {
          const options = args[1];
          if (options && options.encoding) {
            return '{}';
          }
          return Buffer.from('{}');
        }
        throw err;
      }
    },
    readdirSync: (...args) => {
      try {
        return fs.readdirSync(...args);
      } catch (err) {
        if (err.code === 'ENOENT') {
          return [];
        }
        throw err;
      }
    },
  };
}, { virtual: true });

// Now require the actual fs.ts which will use our mocked original-fs
module.exports = jest.requireActual('../src/util/fs');
