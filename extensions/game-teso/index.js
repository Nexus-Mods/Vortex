const { log, util } = require('vortex-api');

const { remote } = require('electron');
const path = require('path');
const Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regkey;

  if (process.arch === 'x32') {
    regkey = '\\Software\\Zenimax_Online\\Launcher';
  } else {
    regkey = '\\Software\\Wow6432Node\\Zenimax_Online\\Launcher';
  }

  const regKey = new Registry({
    hive: Registry.HKLM,
    key: regkey,
  });

  return new Promise((resolve, reject) => {
    regKey.get('InstallPath', (err, result) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(path.join(result.value, 'Launcher'));
      }
    });
  });
}

function modPath() {
  return path.join(remote.app.getPath('documents'), 'Elder Scrolls Online', 'live', 'Addons');
}

function main(context) {
  context.registerGame({
    id: 'teso',
    name: 'The Elder Scroll Online',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.png',
    executable: () => 'Bethesda.net_Launcher.exe',
    requiredFiles: [
      'Bethesda.net_Launcher.exe',
    ],
    details: {
      steamAppId: 306130,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
