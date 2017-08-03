const { log, util } = require('nmm-api');

const path = require('path');
const Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  const regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Zenimax_Online\\Launcher',
  });

  return new Promise((resolve, reject) => {
    regKey.get('InstallPath', (err, result) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(result.value);
      }
    });
  });
}

function modPath() {
  return findGame()
  .then((result) => {
    if (path.basename(path.dirname(filename)) === 'The Elder Scrolls Online EU') {
      return path.join(remote.app.getPath('documents'), 'Elder Scrolls Online', 'live', 'Addons');
    } else {
      return path.join(remote.app.getPath('documents'), 'Elder Scrolls Online', 'liveeu', 'Addons');
    }
  });
}

function main(context) {
  context.registerGame({
    id: 'teso',
    name: 'The Elder Scroll Online',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.png',
    executable: () => 'eso.exe',
    requiredFiles: [
      'eso.exe',
    ],
    supportedTools: null,
    details: {
      steamAppId: 306130,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
