
// This is a workaround for a problem where, when yarn installs/upgrades packages,
// it will delete native modules and may not rebuild them, meaning that after a
// "yarn add" or "yarn upgrade", node_modules is in an invalid state

const https = require('https');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const prebuildRC = require('prebuild-install/rc');
const prebuildUtil = require('prebuild-install/util');

const packageManager = 'yarn';

// verify these modules are installed
const verifyModules = [
  ['xxhash-addon', path.join('build', 'Release', 'addon.node'), false],
  ['vortexmt', path.join('build', 'Release', 'vortexmt.node'), true],
  ['drivelist', path.join('build', 'Release', 'drivelist.node'), true],
  ['diskusage', path.join('build', 'Release', 'diskusage.node'), true],
  ['fomod-installer', path.join('dist', 'ModInstallerIPC.exe'), false],
];

if (process.platform === 'win32') {
  verifyModules.push(
    ['winapi-bindings', path.join('build', 'Release', 'winapi.node'), true],
    ['native-errors', path.join('build', 'Release', 'native-errors.node'), true],
    ['crash-dump', path.join('build', 'Release', 'windump.node'), true],
  );
}

async function verifyModulesInstalled() {
  console.log('checking native modules');
  for (const module of verifyModules) {
    const modPath = path.join(__dirname, 'node_modules', module[0], module[1]);
    try {
      await fs.stat(modPath);
    } catch (err) {
      console.log('missing native module', modPath);
      const pkgcli = process.platform === 'win32' ? `${packageManager}.cmd` : packageManager;
      await new Promise(resolve => {
        const proc = spawn(pkgcli, ['install'], { shell: true, cwd: path.join(__dirname, 'node_modules', module[0]) });
        proc.on('exit', resolve);
      });
      try {
        await fs.stat(modPath);
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
  verifyPrebuild();
  verifyModulesInstalled();
}

main();
