const { log, util } = require('vortex-api');

const { remote } = require('electron');
const fs = require('fs-extra-promise');
const path = require('path');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let grimrock = games.find((entry) => entry.name === 'Legend of Grimrock');
    if (grimrock !== undefined) {
      return grimrock.gamePath;
    }
    return null;
  })
  .catch((err) => {
    log('debug', 'no steam installed?', { err: err.message });
    return null;
  });
}

function modPath() {
  return path.join(remote.app.getPath('documents'), 'Almost Human\\Legend of Grimrock\\Dungeons');
}

function prepareForModding() {
  return fs.ensureDirAsync(modPath());
}

function main(context) {
  context.registerGame({
    id: 'grimrock',
    name: 'Legend of Grimrock',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.png',
    executable: () => 'grimrock.exe',
    requiredFiles: [
      'grimrock.exe',
    ],
    setup: prepareForModding,
    details: {
      steamAppId: 207170,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
