const { log, util } = require('vortex-api');

const { remote } = require('electron');
const fs = require('fs-extra-promise');
const path = require('path');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let starbound = games.find((entry) => entry.name === 'Starbound');
    if (starbound !== undefined) {
      return starbound.gamePath;
    }
    return null;
  })
  .catch((err) => {
    log('debug', 'no steam installed?', { err: err.message });
    return null;
  });
}

function gameExecutable() {
  if (process.platform === 'win32') {
    return 'win32/starbound.exe';
  }
  return 'win64/starbound.exe';
}

function prepareForModding() {
  return fs.ensureDirAsync('mods');
}

function main(context) {
  context.registerGame({
    id: 'starbound',
    name: 'Starbound',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: () => 'mods',
    logo: 'gameart.png',
    executable: gameExecutable,
    requiredFiles: [
      gameExecutable,
    ],
    setup: prepareForModding,
    details: {
      steamAppId: 211820,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
