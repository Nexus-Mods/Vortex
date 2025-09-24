const fs = require('fs');
const path = require('path');

// Track which messages have already been displayed to prevent duplication
const displayedMessages = new Set();

/**
 * Module explanations for different native modules
 */
const moduleExplanations = {
  'leveldown': 'native LevelDB functionality not yet implemented',
  'modmeta-db': 'native database functionality not yet implemented',
  'native-errors': 'native error handling not yet implemented',
  'original-fs': 'testing-only mock, not needed for production',
  'vortex-api': 'testing-only mock, not needed for production',
  'winapi-bindings': 'Windows-specific APIs not applicable on macOS',
  'fomod-installer': 'pure JavaScript implementation preferred',
  'node-addon-api': 'build-time dependency, not a runtime mock',
  'vortexmt': 'native multithreading not yet implemented',
  'xxhash-addon': 'native xxHash functionality not yet implemented'
};

/**
 * Check if we're running on macOS
 */
function isMacOS() {
  return process.platform === 'darwin';
}

/**
 * Get the explanation for a module
 */
function getModuleExplanation(moduleName) {
  return moduleExplanations[moduleName] || 'native functionality not yet implemented';
}

/**
 * Create a unique message key to prevent duplication
 */
function createMessageKey(moduleName, type) {
  return `${moduleName}:${type}`;
}

/**
 * Log a native implementation message (only once per module)
 */
function logNativeImplementation(moduleName, emoji = '✅') {
  if (!isMacOS()) return;
  
  const messageKey = createMessageKey(moduleName, 'native');
  if (displayedMessages.has(messageKey)) return;
  
  console.log(`${emoji} Using native macOS implementation for ${moduleName}`);
  displayedMessages.add(messageKey);
}

/**
 * Log a mock implementation message (only once per module)
 */
function logMockImplementation(moduleName, emoji = '🎭') {
  if (!isMacOS()) return;
  
  const messageKey = createMessageKey(moduleName, 'mock');
  if (displayedMessages.has(messageKey)) return;
  
  const explanation = getModuleExplanation(moduleName);
  console.log(`${emoji} Using mock for ${moduleName} on macOS (${explanation})`);
  displayedMessages.add(messageKey);
}

/**
 * Log a skip message (only once per module)
 */
function logSkipMessage(moduleName, reason) {
  if (!isMacOS()) return;
  
  const messageKey = createMessageKey(moduleName, 'skip');
  if (displayedMessages.has(messageKey)) return;
  
  console.log(`🚫 Skipping ${moduleName} native module building on macOS (${reason})`);
  displayedMessages.add(messageKey);
}

/**
 * Log an installation success message (only once per module per location)
 */
function logInstallationSuccess(moduleName, location, emoji = '✅') {
  if (!isMacOS()) return;
  
  const messageKey = createMessageKey(moduleName, `install:${location}`);
  if (displayedMessages.has(messageKey)) return;
  
  console.log(`${emoji} Installed native macOS implementation for ${moduleName} in ${location}`);
  displayedMessages.add(messageKey);
}

/**
 * Log a summary message (only once)
 */
function logSummary(count, type, emoji = '✅') {
  const messageKey = createMessageKey('summary', type);
  if (displayedMessages.has(messageKey)) return;
  
  console.log(`${emoji} Successfully ${type} ${count} native macOS implementations`);
  displayedMessages.add(messageKey);
}

/**
 * Check if a native implementation exists for a module
 */
function hasNativeImplementation(moduleName, basePath = process.cwd()) {
  const realImplPaths = {
    'drivelist': path.join(basePath, 'src', 'util', 'drivelist-macos.js'),
    'diskusage': path.join(basePath, 'src', 'util', 'diskusage-macos.js'),
    'exe-version': path.join(basePath, 'src', 'util', 'exe-version-macos.js'),
    'turbowalk': path.join(basePath, 'scripts', 'turbowalk-macos.js'),
    'wholocks': path.join(basePath, 'scripts', 'wholocks-macos.js'),
    'permissions': path.join(basePath, 'scripts', 'permissions-macos.js'),
    'bsdiff-node': path.join(basePath, 'scripts', 'bsdiff-macos.js'),
    'ffi': path.join(basePath, 'scripts', 'ffi-macos.js'),
    'ref': path.join(basePath, 'scripts', 'ref-macos.js'),
    'ref-struct': path.join(basePath, 'scripts', 'ref-struct-macos.js'),
    'ref-union': path.join(basePath, 'scripts', 'ref-union-macos.js'),
    'node-7z': path.join(basePath, 'scripts', 'node-7z-macos.js')
  };
  
  const implPath = realImplPaths[moduleName];
  return implPath && fs.existsSync(implPath);
}

/**
 * Check if a mock implementation exists for a module
 */
function hasMockImplementation(moduleName, basePath = process.cwd()) {
  const mockPath = path.join(basePath, '__mocks__', moduleName + '.js');
  return fs.existsSync(mockPath);
}

/**
 * Process a module and log the appropriate message
 */
function processModule(moduleName, basePath = process.cwd()) {
  if (!isMacOS()) return 'unsupported';
  
  // Special handling for drivelist
  if (moduleName === 'drivelist') {
    logSkipMessage(moduleName, 'using real implementation instead');
    return 'skipped';
  }
  
  if (hasNativeImplementation(moduleName, basePath)) {
    logNativeImplementation(moduleName);
    return 'native';
  } else if (hasMockImplementation(moduleName, basePath)) {
    logMockImplementation(moduleName);
    return 'mock';
  }
  
  return 'none';
}

/**
 * Reset displayed messages (useful for testing)
 */
function resetDisplayedMessages() {
  displayedMessages.clear();
}

module.exports = {
  isMacOS,
  logNativeImplementation,
  logMockImplementation,
  logSkipMessage,
  logInstallationSuccess,
  logSummary,
  hasNativeImplementation,
  hasMockImplementation,
  processModule,
  resetDisplayedMessages,
  getModuleExplanation
};