const { log, util } = require('vortex-api');

const fs = require('fs-extra-promise');
const path = require('path');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let game = games.find((entry) => entry.name === 'Dragon\'s Dogma: Dark Arisen');
    if (game !== undefined) {
      return game.gamePath;
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
    id: 'dragonsdogma',
    name: 'Dragon\'s Dogma',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => './',
    logo: 'gameart.png',
    executable: () => 'DDDA.exe',
    requiredFiles: [
      'DDDA.exe',
    ],
    supportedTools: null,
    details: {
      steamAppId: 367500,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
