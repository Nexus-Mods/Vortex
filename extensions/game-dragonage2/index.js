const { app, remote } = require('electron');
const fs = require('fs-extra-promise');
const path = require('path');
const { log, util } = require('vortex-api');
const Registry = require('winreg');

const appUni = app || remote.app;

function findGame() {
  if (Registry === undefined) {
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\BioWare\\Dragon Age 2',
  });

  return new Promise((resolve, reject) => {
    regKey.get('Path', (err, result) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(result.value);
      }
    });
  });
}

function queryModPath() {
  return path.join(appUni.getPath('documents'), 'BioWare', 'Dragon Age 2', 'packages', 'core', 'override');
}

function prepareForModding() {
  return fs.ensureDirAsync(queryModPath());
}

function main(context) {
  context.registerGame({
    id: 'dragonage2',
    name: 'Dragon Age 2',
    mergeMods: false,
    queryPath: findGame,
    queryModPath,
    logo: 'gameart.png',
    executable: () => 'daorigins.exe',
    setup: prepareForModding,
    requiredFiles: [
      'daorigins.exe',
    ],
    details: {
      steamAppId: 17450,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
