// Ensure native modules build with C++ exceptions on macOS/ARM by
// adding -fexceptions and NAPI_CPP_EXCEPTIONS to binding.gyp
const fs = require('fs');
const path = require('path');

const pkgRoot = process.cwd();

// List of native modules that need patching
// Exclude modules that have mocks in __mocks__ directory
const modulesToPatch = [
  'vortexmt',
  'xxhash-addon'
];

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
  'exe-version',
  'node-addon-api',
  'vortexmt',
  'xxhash-addon'
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

// Force npm to use prebuilt binaries for all native modules
for (const moduleName of [...macOnlyMocks, ...windowsOnlyModules]) {
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

// Always configure node-addon-api first to ensure exceptions are enabled
const nodeAddonApiPath = path.join(pkgRoot, 'node_modules', 'node-addon-api');
if (fs.existsSync(nodeAddonApiPath)) {
  const configPath = path.join(nodeAddonApiPath, 'config.gypi');
  const configContent = `{
  'variables': {
    'NAPI_CPP_EXCEPTIONS': 1
  },
  'target_defaults': {
    'cflags!': ['-fno-exceptions'],
    'cflags_cc!': ['-fno-exceptions'],
    'cflags_cc': ['-fexceptions', '-std=c++17'],
    'xcode_settings': {
      'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
      'CLANG_CXX_LIBRARY': 'libc++',
      'MACOSX_DEPLOYMENT_TARGET': '10.15',
      'OTHER_CPLUSPLUSFLAGS': ['-stdlib=libc++', '-fexceptions', '-std=c++17'],
      'OTHER_LDFLAGS': ['-stdlib=libc++']
    }
  }
}`;
  fs.writeFileSync(configPath, configContent, 'utf8');
  console.log('Updated node-addon-api configuration');
}

// Handle macOS-specific mocks and native module compilation
if (process.platform === 'darwin') {

  // Then handle mocked modules
  for (const moduleName of macOnlyMocks) {
    const mockPath = path.join(pkgRoot, '__mocks__', moduleName + '.js');
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

// Create a patched node-addon-api configuration
const nodeAddonApiConfig = {
  'variables': {
    'NAPI_VERSION': '8'
  },
  'target_defaults': {
    'default_configuration': 'Release',
    'configurations': {
      'Release': {
        'defines': [
          'NODE_ADDON_API_ENABLE_MAYBE',
          'NODE_ADDON_API_DISABLE_DEPRECATED',
          'NAPI_CPP_EXCEPTIONS',
          'NAPI_VERSION=<(NAPI_VERSION)'
        ],
        'cflags!': ['-fno-exceptions'],
        'cflags_cc!': ['-fno-exceptions'],
        'cflags_cc': ['-fexceptions', '-std=c++17'],
        'xcode_settings': {
          'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
          'CLANG_CXX_LIBRARY': 'libc++',
          'MACOSX_DEPLOYMENT_TARGET': '10.15',
          'OTHER_CPLUSPLUSFLAGS': ['-fexceptions', '-std=c++17']
        },
        'msvs_settings': {
          'VCCLCompilerTool': { 'ExceptionHandling': 1 }
        }
      }
    }
  }
};

// Write the configuration
const configPath = path.join(process.cwd(), 'node-addon-api.gypi');
fs.writeFileSync(configPath, JSON.stringify(nodeAddonApiConfig, null, 2));

function tryPatch(moduleRoot) {
  const gypPath = path.join(moduleRoot, 'binding.gyp');
  if (!fs.existsSync(gypPath)) return false;

  // Check if node-addon-api is used
  const packageJsonPath = path.join(moduleRoot, 'package.json');
  let usesNodeAddonApi = false;
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    usesNodeAddonApi = packageJson.dependencies && packageJson.dependencies['node-addon-api'];
  }

  const original = fs.readFileSync(gypPath, 'utf8');
  let bindingObj;
  try {
    bindingObj = JSON.parse(original);
  } catch (e) {
    // If parsing fails, fall back to string manipulation
    let modified = original;

    // Add node-addon-api configuration if needed
    if (usesNodeAddonApi) {
      // Add defines for enabling exceptions
      if (!modified.includes('NAPI_CPP_EXCEPTIONS')) {
        modified = modified.replace(/'defines'\s*:\s*\[([^\]]*)\]/, (match, inner) => {
          const trimmed = inner.trim();
          const newDefines = ['NAPI_CPP_EXCEPTIONS'];
          if (trimmed.length === 0) {
            return `'defines': ${JSON.stringify(newDefines)}`;
          }
          const existingDefines = inner.split(',').map(d => d.trim()).filter(d => d.length > 0);
          return `'defines': ${JSON.stringify([...existingDefines, ...newDefines])}`;
        });
      }

      // Add exception flags
      const exceptionFlags = {
        'cflags!': ['-fno-exceptions'],
        'cflags_cc!': ['-fno-exceptions'],
        'cflags_cc': ['-fexceptions', '-std=c++17'],
        'xcode_settings': {
          'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
          'CLANG_CXX_LIBRARY': 'libc++',
          'MACOSX_DEPLOYMENT_TARGET': '10.15',
          'OTHER_CPLUSPLUSFLAGS': ['-fexceptions', '-std=c++17']
        },
        'msvs_settings': {
          'VCCLCompilerTool': { 'ExceptionHandling': 1 }
        }
      };

      // Add each flag section if not present
      Object.entries(exceptionFlags).forEach(([key, value]) => {
        if (!modified.includes(`'${key}'`)) {
          modified = modified.replace(/'sources'\s*:\s*\[[^\]]*\]/, match => {
            return `${match},\n      '${key}': ${JSON.stringify(value)}`;
          });
        }
      });
    }

    // Insert defines array if missing
    if (!/'defines'\s*:/.test(modified)) {
      modified = modified.replace(/'sources'\s*:\s*\[[^\]]*\]/, match => {
        return match + ',\n      "defines": [ "NODE_ADDON_API_DISABLE_DEPRECATED", "NODE_ADDON_API_ENABLE_MAYBE" ]';
      });
    } else if (!/NODE_ADDON_API_DISABLE_DEPRECATED/.test(modified)) {
      modified = modified.replace(/'defines'\s*:\s*\[([^\]]*)\]/, (m, inner) => {
        const trimmed = inner.trim();
        if (trimmed.length === 0) return '"defines": [ "NODE_ADDON_API_DISABLE_DEPRECATED", "NODE_ADDON_API_ENABLE_MAYBE" ]';
        return `"defines": [ ${inner.replace(/\s+$/,"")}, "NODE_ADDON_API_DISABLE_DEPRECATED", "NODE_ADDON_API_ENABLE_MAYBE" ]`;
      });
    }

    // Insert cflags_cc array if missing
    if (!/'cflags_cc'\s*:/.test(modified)) {
      modified = modified.replace(/'sources'\s*:\s*\[[^\]]*\]/, match => {
        return match + ',\n      "cflags_cc": [ "-fexceptions", "-std=c++17" ]';
      });
    } else if (!/-fexceptions/.test(modified)) {
      modified = modified.replace(/'cflags_cc'\s*:\s*\[([^\]]*)\]/, (m, inner) => {
        const trimmed = inner.trim();
        if (trimmed.length === 0) return '"cflags_cc": [ "-fexceptions", "-std=c++17" ]';
        return `"cflags_cc": [ ${inner.replace(/\s+$/,"")}, "-fexceptions", "-std=c++17" ]`;
      });
    }

    // Add xcode_settings for macOS
    if (!/xcode_settings/.test(modified)) {
      modified = modified.replace(/'target_name'\s*:\s*[^,}]+[,}]/, match => {
        return match + ',\n      "xcode_settings": { "GCC_ENABLE_CPP_EXCEPTIONS": "YES", "CLANG_CXX_LIBRARY": "libc++", "MACOSX_DEPLOYMENT_TARGET": "10.15" }';
      });
    }

    // Add conditions for macOS ARM64
    if (!/conditions/.test(modified)) {
      modified = modified.replace(/\{\s*'targets':\s*\[/, match => {
        return match + '\n    { "conditions": [ [ "OS==\'mac\'", { "xcode_settings": { "MACOSX_DEPLOYMENT_TARGET": "10.15" } } ] ] },';
      });
    }

    if (modified !== original) {
      fs.writeFileSync(gypPath, modified, 'utf8');
      return true;
    }
    return true; // already had the flags
  }
  return false;
}

for (const moduleName of modulesToPatch) {
  // Try node_modules first
  let moduleRoot = path.join(pkgRoot, 'node_modules', moduleName);
  let patched = tryPatch(moduleRoot);

  // Try extensions/collections/node_modules as fallback
  if (!patched) {
    moduleRoot = path.join(pkgRoot, 'extensions', 'collections', 'node_modules', moduleName);
    patched = tryPatch(moduleRoot);
  }

  if (patched) {
    console.log(`Patched ${moduleName}`);
  } else {
    console.log(`Could not locate ${moduleName} to patch`);
  }
}