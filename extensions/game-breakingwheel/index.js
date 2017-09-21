const { log, util } = require('vortex-api');

const path = require('path');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let breakingwheel = games.find((entry) => entry.name === 'Breaking Wheel');
    if (breakingwheel !== undefined) {
      return breakingwheel.gamePath;
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
    id: 'breakingwheel',
    name: 'Breaking Wheel',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: () => 'ModdingTools',
    logo: 'gameart.png',
    executable: () => 'Ellie_Ball_Project.exe',
    requiredFiles: [
      'Ellie_Ball_Project.exe',
    ],
    details: {
      steamAppId: 545890,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
