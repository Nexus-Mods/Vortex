const { log, util } = require('vortex-api');

const path = require('path');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let nomanssky = games.find((entry) => entry.name === 'No Man\'s Sky');
    if (nomanssky !== undefined) {
      return nomanssky.gamePath;
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
    id: 'nomanssky',
    name: 'No Man\'s Sky',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: () => path.join('GAMEDATA', 'PCBANKS', 'MODS'),
    logo: 'gameart.png',
    executable: () => 'NMS.exe',
    requiredFiles: [
      'NMS.exe',
    ],
    details: {
      steamAppId: 275850,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
