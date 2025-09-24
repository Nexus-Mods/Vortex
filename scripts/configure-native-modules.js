// Configure environment variables for native module handling
// This script sets up the appropriate environment variables to ensure
// native modules are handled correctly on different platforms

const fs = require('fs');
const path = require('path');

// Platform detection utilities
function isWindows() {
  return process.platform === 'win32';
}

function isMacOS() {
  return process.platform === 'darwin';
}

// List of modules that need mocks on macOS
const macOnlyMocks = [
  'drivelist',
  'bsdiff-node',
  'diskusage',
  'leveldown',
  'modmeta-db',
  'native-errors',
  'node-7z',
  'original-fs',
  'permissions',
  'ref',
  'ref-struct',
  'ref-union',
  'turbowalk',
  'vortex-api',
  'wholocks',
  'winapi-bindings',
  'ffi',
  'exe-version'
];

// Windows-only modules that should use mocks
const windowsOnlyModules = [
  'bsdiff-node',
  'diskusage',
  'drivelist',
  'exe-version',
  'leveldown',
  'modmeta-db',
  'native-errors',
  'node-7z',
  'original-fs',
  'permissions',
  'ref',
  'ref-struct',
  'ref-union',
  'turbowalk',
  'vortex-api',
  'wholocks',
  'winapi-bindings'
];

// Set global environment variables to skip native builds and force prebuilt binaries
process.env.SKIP_NATIVE_BUILD = '1';
process.env.PREBUILD_INSTALL_ONLY = '1';
process.env.npm_config_build_from_source = 'false';
process.env.YARN_IGNORE_PATH = '1';
process.env.YARN_SKIP_NATIVE_BUILD = '1';
process.env.YARN_PREBUILD_INSTALL_ONLY = '1';

// Force npm to use prebuilt binaries for all native modules
for (const moduleName of [...macOnlyMocks, ...windowsOnlyModules]) {
  const upperModuleName = moduleName.toUpperCase().replace(/-/g, '_');
  process.env[`YARN_${moduleName}_binary_host_mirror`] = 'none';
  process.env[`YARN_${moduleName}_skip_build`] = 'true';
  process.env[`YARN_${moduleName}_prebuild`] = 'false';
  process.env[`YARN_${moduleName}_build_from_source`] = 'false';
  process.env[`SKIP_${upperModuleName}_BUILD`] = '1';
  process.env[`SKIP_${upperModuleName}_PREBUILD`] = '1';
  process.env[`SKIP_${upperModuleName}_DOWNLOAD`] = '1';
  process.env[`${upperModuleName}_SKIP_DOWNLOAD`] = '1';
  process.env[`${upperModuleName}_SKIP_BUILD`] = '1';
}

// Handle macOS-specific mocks and native module compilation
if (isMacOS()) {
  // Aggressively skip drivelist building on macOS to reduce build errors
  console.log('Skipping drivelist native module building on macOS');
  process.env.npm_config_drivelist_binary_host_mirror = 'none';
  process.env.npm_config_drivelist_skip_build = 'true';
  process.env.npm_config_drivelist_prebuild = 'false';
  process.env.npm_config_drivelist_build_from_source = 'false';
  process.env.SKIP_DRIVELIST_BUILD = '1';
  process.env.SKIP_DRIVELIST_PREBUILD = '1';
  process.env.SKIP_DRIVELIST_DOWNLOAD = '1';
  process.env.DRIVELIST_SKIP_DOWNLOAD = '1';
  process.env.DRIVELIST_SKIP_BUILD = '1';
  process.env.DRIVELIST_SKIP_INSTALL = '1';
  
  // Then handle mocked modules
  for (const moduleName of macOnlyMocks) {
    // Skip drivelist if we have a real implementation
    if (moduleName === 'drivelist') {
      const realImplPath = path.join(process.cwd(), 'src', 'util', 'drivelist-macos.js');
      if (fs.existsSync(realImplPath)) {
        console.log(`Using real implementation for ${moduleName} on macOS`);
        continue;
      }
    }
    
    const mockPath = path.join(process.cwd(), '__mocks__', moduleName + '.js');
    if (fs.existsSync(mockPath)) {
      console.log(`Using mock for ${moduleName} on macOS`);
      // Skip native module compilation for mocked modules on macOS
      const upperModuleName = moduleName.toUpperCase().replace(/-/g, '_');
      process.env[`npm_config_${moduleName}_binary_host_mirror`] = 'none';
      process.env[`npm_config_${moduleName}_skip_build`] = 'true';
      process.env[`npm_config_${moduleName}_prebuild`] = 'false';
      process.env[`npm_config_${moduleName}_build_from_source`] = 'false';
      process.env[`SKIP_${upperModuleName}_BUILD`] = '1';
      process.env[`SKIP_${upperModuleName}_PREBUILD`] = '1';
      process.env[`SKIP_${upperModuleName}_DOWNLOAD`] = '1';
      process.env[`${upperModuleName}_SKIP_DOWNLOAD`] = '1';
      process.env[`${upperModuleName}_SKIP_BUILD`] = '1';
    }
  }
}

console.log('Native module environment configuration completed');