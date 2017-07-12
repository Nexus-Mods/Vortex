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
    key: '\\Software\\Maxis\\The Sims 3',
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
  return path.join(remote.app.getPath('documents'), 'Electronic Arts', 'The Sims 3', 'Mods');
}

let tools = [
  {
    id: 'sevenzip',
    name: '7-Zip',
    executable: () => '7zFM.exe',
    requiredFiles: [
      '7zFM.exe',
    ],
  },
];

function main(context) {
  context.registerGame({
    id: 'thesims3',
    name: 'The Sims 3',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.png',
    executable: () => 'game/bin/TS3.exe',
    requiredFiles: [
      'game/bin/TS3.exe',
    ],
    supportedTools: tools,
    details: {
      steamAppId: 47890,
    },
  });
  return true;
}

module.exports = {
  default: main,
};
