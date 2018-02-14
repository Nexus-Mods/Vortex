const { log, util } = require('vortex-api');

const path = require('path');

function findGame() {
  return util.steam.findByName('No Man\'s Sky')
      .then(game => game.gamePath);
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
