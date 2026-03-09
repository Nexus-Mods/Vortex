const path = require('path');
const { fs, log, util } = require('vortex-api');

const MS_ID = 'Chucklefish.StarboundWindows10Edition';

function findGame() {
  return util.steam.findByName('Starbound')
      .catch(() => util.GameStoreHelper.findByAppId([MS_ID], 'xbox'))
      .then(game => game.gamePath);
}

function gameExecutable(discoveryPath) {
  const defaultLocation = 'win64/starbound.exe';
  const xboxLocation = 'win/starbound.exe';
  if (discoveryPath === undefined
   || discoveryPath.toLowerCase().indexOf('modifiablewindowsapps') === -1) {
    return defaultLocation;
  } else {
    try {
      fs.statSync(path.join(discoveryPath, xboxLocation));
      return xboxLocation;
    } catch (err) {
      return defaultLocation;
    }
  }
}

function prepareForModding(discovery) {
  return fs.ensureDirAsync(path.join(discovery.path, 'mods'));
}

function requiresLauncher(gamePath) {
  return util.GameStoreHelper.findByAppId([MS_ID], 'xbox')
    .then(() => Promise.resolve({
      launcher: 'xbox',
      addInfo: {
        appId: MS_ID,
        parameters: [
          { appExecName: 'StarboundClient' },
        ],
      }
    }))
    .catch(err => Promise.resolve(undefined));
}

function main(context) {
  context.registerGame({
    id: 'starbound',
    name: 'Starbound',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'mods',
    logo: 'gameart.jpg',
    executable: gameExecutable,
    requiredFiles: [
      'assets/packed.pak',
      'assets/user/songs/12 Days Of Christmas.abc'
    ],
    setup: prepareForModding,
    requiresLauncher,
    environment: {
      SteamAPPId: '211820',
    },
    details: {
      steamAppId: 211820,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
