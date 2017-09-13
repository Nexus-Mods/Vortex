const { log, util } = require('vortex-api');

const path = require('path');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let stateofdecay = games.find((entry) => entry.name === 'State of Decay');
    if (stateofdecay !== undefined) {
      return stateofdecay.gamePath;
    }
    return null;
  })
  .catch((err) => {
    log('debug', 'no steam installed?', { err: err.message });
    return null;
  });
}

function modPath() {
  return 'game';
}

function main(context) {
  context.registerGame({
    id: 'stateofdecay',
    name: 'State of Decay',
    mergeMods: false,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.png',
    executable: () => 'StateOfDecay.exe',
    requiredFiles: [
      'StateOfDecay.exe',
    ],
    supportedTools: null,
    details: {
      steamAppId: 241540,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
