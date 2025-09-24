// This is a workaround for a problem where, when yarn installs/upgrades packages,
// it will delete native modules and may not rebuild them, meaning that after a
// "yarn add" or "yarn upgrade", node_modules is in an invalid state

const https = require('https');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { spawn } = require('child_process');
const prebuildRC = require('prebuild-install/rc');
const prebuildUtil = require('prebuild-install/util');
const { 
  isMacOS, 
  logNativeImplementation,
  logMockImplementation,
  processModule
} = require('./scripts/native-module-messages');

const statAsync = promisify(fs.stat);

// Platform detection utilities
function isWindows() {
  return process.platform === 'win32';
}

const packageManager = 'yarn';

// verify these modules are installed
const verifyModules = [
  ['xxhash-addon', path.join('build', 'Release', 'addon.node'), false],
  ['vortexmt', path.join('build', 'Release', 'vortexmt.node'), true],
  ['fomod-installer', path.join('dist', 'ModInstallerIPC.exe'), false],
];

// Only verify Windows-specific modules on Windows
if (isWindows()) {
  verifyModules.push(
    ['drivelist', path.join('build', 'Release', 'drivelist.node'), true],
    ['diskusage', path.join('build', 'Release', 'diskusage.node'), true],
    ['winapi-bindings', path.join('build', 'Release', 'winapi.node'), true],
    ['native-errors', path.join('build', 'Release', 'native-errors.node'), true],
    ['crash-dump', path.join('build', 'Release', 'windump.node'), true]
  );
}

// Function to ensure TypeScript types are properly installed
async function ensureTypesInstalled() {
  console.log('Ensuring TypeScript types are properly installed...');
  
  // Check if @types/rimraf is properly installed
  try {
    const rimrafTypesPath = path.join(__dirname, 'node_modules', '@types', 'rimraf');
    await statAsync(rimrafTypesPath);
    const files = await fs.promises.readdir(rimrafTypesPath);
    if (files.length === 0) {
      console.log('@types/rimraf is empty, may need reinstallation');
    }
  } catch (err) {
    console.log('@types/rimraf is missing, may need installation');
  }
}

// Function to prevent drivelist from building on macOS
async function preventDrivelistBuild() {
  if (!isMacOS()) return;
  
  // Paths to check for drivelist
  const drivelistPaths = [
    path.join(__dirname, 'node_modules', 'drivelist'),
    path.join(__dirname, 'app', 'node_modules', 'drivelist')
  ];
  
  for (const drivelistPath of drivelistPaths) {
    const packageJsonPath = path.join(drivelistPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        // Also set gypfile to false to prevent native compilation
        packageJson.gypfile = false;
        // Only add scripts if the package.json has more than just basic fields
        if (Object.keys(packageJson).length > 5) {
          // Ensure scripts object exists
          if (!packageJson.scripts) {
            packageJson.scripts = {};
          }
          // Change the install script to prevent building
          packageJson.scripts.install = 'echo "Using native macOS implementation instead of building from source" && exit 0';
        }
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
        console.log(`✅ Prevented drivelist build in ${drivelistPath}`);
      } catch (err) {
        console.log(`⚠️  Failed to modify drivelist package.json in ${drivelistPath}: ${err.message}`);
      }
    }
  }
}

async function verifyModulesInstalled() {
  console.log('checking native modules');
  
  // Prevent drivelist from building on macOS
  await preventDrivelistBuild();
  
  for (const module of verifyModules) {
    // Skip verification if mock exists on macOS
    if (isMacOS()) {
      // Special handling for drivelist - check if real implementation exists
      if (module[0] === 'drivelist') {
        const realImplPath = path.join(__dirname, 'src', 'util', 'drivelist-macos.js');
        const realModulePath = path.join(__dirname, 'node_modules', 'drivelist', 'index.js');
        try {
          await statAsync(realImplPath);
          await statAsync(realModulePath);
          processModule(module[0]);
          continue;
        } catch (err) {
          // Fall back to mock if real implementation doesn't exist
          const mockPath = path.join(__dirname, '__mocks__', module[0] + '.js');
          try {
            await statAsync(mockPath);
            processModule(module[0]);
            continue;
          } catch (mockErr) {
            // No mock found, proceed with verification
            console.log(`No implementation found for ${module[0]} on macOS, proceeding with verification`);
          }
        }
      } else {
        // Check if we have a native macOS implementation for this module
        const nativeImplPaths = {
          'diskusage': path.join(__dirname, 'src', 'util', 'diskusage-macos.js'),
          'exe-version': path.join(__dirname, 'src', 'util', 'exe-version-macos.js'),
          'turbowalk': path.join(__dirname, 'scripts', 'turbowalk-macos.js'),
          'wholocks': path.join(__dirname, 'scripts', 'wholocks-macos.js'),
          'permissions': path.join(__dirname, 'scripts', 'permissions-macos.js'),
          'bsdiff-node': path.join(__dirname, 'scripts', 'bsdiff-macos.js'),
          'ffi': path.join(__dirname, 'scripts', 'ffi-macos.js'),
          'ref': path.join(__dirname, 'scripts', 'ref-macos.js'),
          'ref-struct': path.join(__dirname, 'scripts', 'ref-struct-macos.js'),
          'ref-union': path.join(__dirname, 'scripts', 'ref-union-macos.js'),
          'node-7z': path.join(__dirname, 'scripts', 'node-7z-macos.js')
        };
        
        if (nativeImplPaths[module[0]] && fs.existsSync(nativeImplPaths[module[0]])) {
          processModule(module[0]);
          continue;
        }
        
        const mockPath = path.join(__dirname, '__mocks__', module[0] + '.js');
        if (fs.existsSync(mockPath)) {
          processModule(module[0]);
          continue;
        } else {
          // No mock found, proceed with verification
          console.log(`No implementation found for ${module[0]} on macOS, proceeding with verification`);
        }
      }
    }
    
    // Skip fomod-installer verification on non-Windows platforms
    if (module[0] === 'fomod-installer' && !isWindows()) {
      console.log(`Skipping ${module[0]} verification on ${process.platform} (Windows-only module)`);
      continue;
    }
    const modPath = path.join(__dirname, 'node_modules', module[0], module[1]);
    try {
      await statAsync(modPath);
    } catch (err) {
      console.log('missing native module', modPath);
      const pkgcli = isWindows() ? `${packageManager}.cmd` : packageManager;
      await new Promise(resolve => {
        const proc = spawn(pkgcli, ['install'], { shell: true, cwd: path.join(__dirname, 'node_modules', module[0]) });
        proc.on('exit', resolve);
      });
      try {
        await statAsync(modPath);
      } catch (err) {
        console.error('failed to build native module', modPath);
        process.exit(1);
      }
    }
  }
}

async function testURL(targetURL) {
  return new Promise((resolve, reject) => {
    const req = https.get(targetURL, {}, res => {
      if ([200, 302].includes(res.statusCode)) {
        resolve(true);
      } else {
        resolve(false);
      }
      req.end();
      req.destroy();
      res.destroy();
    })
      .on('error', err => {
        console.log('connection failed', err);
        resolve(false);
      });
  });
}

async function verifyPrebuild() {
  console.log('checking modules are prebuilt');
  for (const module of verifyModules) {
    if (!module[2]) {
      // not expected to be prebuilt
      continue;
    }
    const pkg = require(path.join(__dirname, 'node_modules', module[0], 'package.json'));
    if ((pkg.name === undefined) || (pkg.repository === undefined)) {
      console.log('misconfigured module', module[0]);
      continue;
    }
    if (pkg.config === undefined) {
      pkg.config = {};
    }
    pkg.config.arch = pkg.config.arch ?? 'x64';
    pkg.config.runtime = pkg.config.runtime ?? 'napi';
    const opts = { ...prebuildRC(pkg), abi: '4', pkg };
    const dlURL = prebuildUtil.getDownloadUrl(opts);
    const exists = await testURL(dlURL);
    if (!exists) {
      console.log('module not prebuilt', module[0]);
    }
  }
}

async function main() {
  await ensureTypesInstalled();
  await verifyPrebuild();
  await verifyModulesInstalled();
}

main();