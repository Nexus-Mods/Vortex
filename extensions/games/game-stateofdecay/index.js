const path = require('path');
const { log, util } = require('vortex-api');

function findGame() {
  return util.steam.findByName('State of Decay: Year-One')
      .catch(err => err instanceof util.GameNotFound
        ? util.steam.findByName('State of Decay')
        : Promise.reject(err))
      .then(game => game.gamePath);
}

function main(context) {
  context.registerGame({
    id: 'stateofdecay',
    name: 'State of Decay',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'game',
    logo: 'gameart.jpg',
    executable: () => 'StateOfDecay.exe',
    requiredFiles: [
      'StateOfDecay.exe',
    ],
    environment: {
      SteamAPPId: '241540',
    },
    details: {
      steamAppId: 241540,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
