const { util } = require('vortex-api');

const GAME_ID = 'balatro';

function findGame() {
  return util.steam.findByAppId('2379780')
    .then(game => game.gamePath);
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Balatro',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: [],
    executable: () => 'Balatro.exe',
    requiredFiles: [
      'Balatro.exe'
    ],
    setup: () => Promise.resolve(),
    environment: {
      SteamAPPId: '2379780',
    },
    details: {
      steamAppId: 2379780,
    },
  });

  return true;
}

module.exports = {
  default: main,
};