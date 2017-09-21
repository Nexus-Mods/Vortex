const Promise = require('bluebird');
const Registry = require('winreg');

const { remote } = require('electron');
const path = require('path');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  const regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Maxis\\The Sims 4',
  });

  return new Promise((resolve, reject) => {
    regKey.get('Install Dir', (err, result) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(result.value);
      }
    });
  });
}

function modPath() {
  return path.join(remote.app.getPath('documents'), 'Electronic Arts', 'The Sims 4', 'Mods');
}

function main(context) {
  context.registerGame({
    id: 'thesims4',
    name: 'The Sims 4',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.png',
    executable: () => 'game/bin/TS4.exe',
    requiredFiles: [
      'game/bin/TS4.exe',
    ],
  });

  return true;
}

module.exports = {
  default: main
};
