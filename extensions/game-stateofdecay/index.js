const path = require('path');
const { log, util } = require('vortex-api');

function findGame() {
  return util.steam.findByName('State of Decay')
      .then(game => game.gamePath);
}

function main(context) {
  context.registerGame({
    id: 'stateofdecay',
    name: 'State of Decay',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: () => 'game',
    logo: 'gameart.png',
    executable: () => 'StateOfDecay.exe',
    requiredFiles: [
      'StateOfDecay.exe',
    ],
    details: {
      steamAppId: 241540,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
