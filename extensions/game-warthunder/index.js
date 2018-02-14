const path = require('path');
const { log, util } = require('vortex-api');

function findGame() {
  return util.steam.findByName('War Thunder')
      .then(game => game.gamePath);
}

function main(context) {
  context.registerGame({
    id: 'warthunder',
    name: 'War Thunder',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: () => 'UserSkins',
    logo: 'gameart.png',
    executable: () => 'aces.exe',
    requiredFiles: [
      'aces.exe',
    ],
    details: {
      steamAppId: 236390,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
