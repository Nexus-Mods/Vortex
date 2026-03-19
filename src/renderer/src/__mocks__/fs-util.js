/**
 * Mock for src/util/fs.ts
 * Uses jest.requireActual to load the real fs.ts but wraps problematic methods
 */

// Mock original-fs to prevent electron dependency issues
jest.mock('__mocks__/original-fs', () => {
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

const actualFs = jest.requireActual('../util/fs');

// Provide a mock for readFileBOM that works with the test's fs-extra mock
const readFileBOM = (filePath, fallbackEncoding = 'utf8') => {
  const { decode } = require('iconv-lite');
  
  return require('fs-extra').readFile(filePath).then(buffer => {
    const KNOWN_BOMS = [
      { bom: Buffer.from([0xEF, 0xBB, 0xBF]), enc: 'utf8', length: 3 },
      { bom: Buffer.from([0x00, 0x00, 0xFE, 0xFF]), enc: 'utf32-be', length: 4 },
      { bom: Buffer.from([0xFF, 0xFE, 0x00, 0x00]), enc: 'utf32-le', length: 4 },
      { bom: Buffer.from([0xFE, 0xFF]), enc: 'utf16be', length: 2 },
      { bom: Buffer.from([0xFF, 0xFE]), enc: 'utf16le', length: 2 },
    ];
    
    const detectedBom = KNOWN_BOMS.find(b =>
      (b.bom.length <= buffer.length) && (b.bom.compare(buffer, 0, b.bom.length) === 0));
    
    if (detectedBom) {
      return decode(buffer.slice(detectedBom.length), detectedBom.enc);
    } else {
      return decode(buffer, fallbackEncoding);
    }
  });
};

module.exports = {
  ...actualFs,
  readFileBOM,
};
