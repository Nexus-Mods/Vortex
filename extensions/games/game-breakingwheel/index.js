const { log, util } = require('vortex-api');

const path = require('path');

function findGame() {
  return util.steam.findByName('Breaking Wheel')
    .then(game => game.gamePath);
}

function main(context) {
  context.registerGame({
    id: 'breakingwheel',
    name: 'Breaking Wheel',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'ModdingTools',
    logo: 'gameart.jpg',
    executable: () => 'Ellie_Ball_Project.exe',
    requiredFiles: [
      'Ellie_Ball_Project.exe',
    ],
    environment: {
      SteamAPPId: '545890',
    },
    details: {
      steamAppId: 545890,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
