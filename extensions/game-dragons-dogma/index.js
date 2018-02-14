const path = require('path');
const { fs, log, util } = require('vortex-api');

function findGame() {
  return util.steam.findByName('Dragon\'s Dogma: Dark Arisen')
      .then(game => game.gamePath);
}

function main(context) {
  context.requireExtension('mtframework-arc-support');

  context.registerGame({
    id: 'dragonsdogma',
    name: 'Dragon\'s Dogma',
    mergeMods: true,
    mergeArchive: filePath => path.basename(filePath).toLowerCase() === 'game_main.arc',
    queryPath: findGame,
    queryModPath: () => 'nativePC',
    logo: 'gameart.png',
    executable: () => 'DDDA.exe',
    requiredFiles: [
      'DDDA.exe',
    ],
    details: {
      steamAppId: 367500,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
