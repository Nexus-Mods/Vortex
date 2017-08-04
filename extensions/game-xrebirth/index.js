const { log, util } = require('nmm-api');

const fs = require('fs-extra-promise');
const path = require('path');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let xrebirth = games.find((entry) => entry.name === 'X Rebirth');
    if (xrebirth !== undefined) {
      return xrebirth.gamePath;
    }
    return null;
  })
  .catch((err) => {
    log('debug', 'no steam installed?', { err: err.message });
    return null;
  });
}

function main(context) {
  context.registerGame({
    id: 'xrebirth',
    name: 'X Rebirth',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: () => 'extensions/',
    logo: 'gameart.png',
    executable: () => 'XRebirth.exe',
    requiredFiles: [
      'XRebirth.exe',
    ],
    supportedTools: null,
    details: {
      steamAppId: 2870,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
