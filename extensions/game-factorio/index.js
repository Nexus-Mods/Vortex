const { log, util } = require('vortex-api');

const Promise = require('bluebird');
const { remote } = require('electron');
const fs = require('fs-extra-promise');
const path = require('path');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let factorio = games.find((entry) => entry.name === 'Factorio');
    if (factorio !== undefined) {
      return factorio.gamePath;
    }
    return null;
  })
  .catch((err) => {
    log('debug', 'no steam installed?', { err: err.message });
    return null;
  });
}

function modPath() {
  return (process.platform === 'win32')
      ? path.join(remote.app.getPath('appData'), 'Factorio', 'mods')
      : path.join(remote.app.getPath('home'), '.factorio', 'mods');
}

function gameExecutable() {
  return (process.platform === 'win32')
    ? 'bin/x64/Factorio.exe'
    : 'bin/x64/factorio';
}

function prepareForModding() {
  return fs.ensureDirAsync(modPath());
}

function main(context) {
  context.registerGame({
    id: 'factorio',
    name: 'Factorio',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.png',
    executable: gameExecutable,
    requiredFiles: [
      'data/core/graphics/factorio.ico',
    ],
    setup: prepareForModding,
    details: {
      steamAppId: 427520,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
