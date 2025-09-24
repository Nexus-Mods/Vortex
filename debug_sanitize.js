// Debug script to test sanitizeFilename function
const path = require('path');

// Mock the platform to be Windows for consistent testing
Object.defineProperty(process, 'platform', {
  value: 'win32'
});

// Simulate the isWindows function
function isWindows() {
  return process.platform === 'win32';
}

// Simulate the escapeRE function
function escapeRE(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Constants from the util.ts file
const INVALID_FILEPATH_CHARACTERS = isWindows()
  ? ['/', '?', '*', ':', '|', '"', '<', '>']
  : [];

const INVALID_FILENAME_CHARACTERS = [].concat(INVALID_FILEPATH_CHARACTERS, path.sep);

const INVALID_FILENAME_RE = new RegExp(`[${escapeRE(INVALID_FILENAME_CHARACTERS.join(''))}]`, 'g');

const RESERVED_NAMES = new Set(isWindows()
  ? [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
    '..', '.',
  ]
  : ['..', '.']);

// Current sanitizeFilename implementation
function sanitizeFilename(input) {
  if (input.length === 0) {
    return '_empty_';
  }
  if (RESERVED_NAMES.has(path.basename(input, path.extname(input)).toUpperCase())) {
    return path.join(path.dirname(input), '_reserved_' + path.basename(input));
  }
  if (isWindows()
    && (input.endsWith(' ') || input.endsWith('.'))) {
    return input + '_';
  }
  return input.replace(INVALID_FILENAME_RE, invChar => `_${invChar.charCodeAt(0)}_`);
}

// Test cases
console.log('🧪 Testing sanitizeFilename function:');
console.log('🖥️ Platform:', process.platform);
console.log('🚫 INVALID_FILENAME_CHARACTERS:', INVALID_FILENAME_CHARACTERS);
console.log('🔍 INVALID_FILENAME_RE:', INVALID_FILENAME_RE);
console.log('');

console.log('🧪 Test 1: foo*bar');
const result1 = sanitizeFilename('foo*bar');
console.log('📤 Result:', result1);
console.log('✅ Expected: foo_42_bar');
console.log('🎯 Match:', result1 === 'foo_42_bar');
console.log('');

console.log('🧪 Test 2: LPT1.txt');
const result2 = sanitizeFilename('LPT1.txt');
console.log('📤 Result:', result2);
console.log('✅ Expected: _reserved_LPT1.txt');
console.log('🎯 Match:', result2 === '_reserved_LPT1.txt');
console.log('');

console.log('🧪 Test 3: foobar.');
const result3 = sanitizeFilename('foobar.');
console.log('📤 Result:', result3);
console.log('✅ Expected: foobar._');
console.log('🎯 Match:', result3 === 'foobar._');
console.log('');

// Debug character code for *
console.log('🔢 Character code for *:', '*'.charCodeAt(0));