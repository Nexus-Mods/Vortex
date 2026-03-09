const Promise = require('bluebird');
const { remote } = require('electron');
const path = require('path');
const { fs, log, util } = require('vortex-api');

function findGame() {
  return util.steam.findByName('Factorio')
      .then(game => game.gamePath);
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
    mergeMods: true,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.jpg',
    executable: gameExecutable,
    requiredFiles: [
      'data/core/graphics/factorio.ico',
    ],
    setup: prepareForModding,
    environment: {
      SteamAPPId: '427520',
    },
    details: {
      steamAppId: 427520,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
