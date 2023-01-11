
// This is a workaround for a problem where, when yarn installs/upgrades packages,
// it will delete native modules and may not rebuild them, meaning that after a
// "yarn add" or "yarn upgrade", node_modules is in an invalid state

const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

const packageManager = 'yarn';

const modules = [
  ['winapi-bindings', path.join('build', 'Release', 'winapi.node')],
  ['xxhash-addon', path.join('build', 'Release', 'addon.node')],
  ['libxmljs', path.join('build', 'Release', 'xmljs.node')],
  ['native-errors', path.join('build', 'Release', 'native-errors.node')],
  ['crash-dump', path.join('build', 'Release', 'windump.node')],
  ['vortexmt', path.join('build', 'Release', 'vortexmt.node')],
  ['harmony-patcher', path.join('dist', 'VortexHarmonyExec.exe')],
  ['fomod-installer', path.join('dist', 'ModInstallerIPC.exe')],
];

async function main() {
  console.log('checking native modules');
  for (const module of modules) {
    const modPath = path.join(__dirname, 'node_modules', module[0], module[1]);
    try {
      await fs.stat(modPath);
    } catch (err) {
      console.log('missing native module', modPath);
      const pkgcli = process.platform === 'win32' ? `${packageManager}.cmd` : packageManager;
      await new Promise(resolve => {
        const proc = spawn(pkgcli, ['install'], { cwd: path.join(__dirname, 'node_modules', module[0]) });
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

main();
