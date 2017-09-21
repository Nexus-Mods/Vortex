const path = require('path');
const { log, util } = require('vortex-api');

function findGame() {
  let steam = new util.Steam();
  return steam.allGames()
  .then((games) => {
    let warthunder = games.find((entry) => entry.name === 'War Thunder');
    if (warthunder !== undefined) {
      return warthunder.gamePath;
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
