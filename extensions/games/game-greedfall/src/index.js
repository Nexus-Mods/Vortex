const Promise = require('bluebird');
const path = require('path');
const { fs, selectors, types, util } = require('vortex-api');

const GAME_ID = 'greedfall';

function findGame() {
  return util.steam.findByAppId("606880").then(game => game.gamePath);
}

function modPath(discovery) {
  return path.join(discovery.path, 'datalocal');
}

function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(modPath(discovery), () => Promise.resolve());
}

function isFomod(files) {
  return files.find(file =>
      (path.basename(file).toLowerCase() === 'moduleconfig.xml')
      && (path.basename(path.dirname(file)).toLowerCase() === 'fomod'));
}

function testMod(files, gameId) {
  const supported = (gameId === GAME_ID) && !isFomod(files);

  return Promise.resolve({
    supported,
    requiredFiles: []
  });
}

/**
 * @param {string[]} files
 * @param {string} destinationPath
 */
function installMod(files, destinationPath) {
  const instructions = files.map(file => {
    const segments = file.split(path.sep);
    const offset = segments.findIndex(seg => seg.toLowerCase() === 'datalocal');
    const outPath = offset !== -1
      ? segments.slice(offset + 1).join(path.sep)
      : file;

    if (file.endsWith(path.sep)) {
      return {
        type: 'mkdir',
        destination: outPath,
      };
    } else {
      return {
        type: 'copy',
        source: file,
        destination: outPath,
      };
    }
  });

  return Promise.resolve({ instructions });
}

function getGameVersion(gamePath) {
  const exeVersion = require('exe-version');
  return Promise.resolve(exeVersion.getProductVersionLocalized(path.join(gamePath, 'GreedFall.exe')));
}



const gameParameters = {
  id: GAME_ID,
  name: 'GreedFall',
  logo: 'gameart.jpg',
  mergeMods: true,
  queryPath: findGame,
  getGameVersion,
  queryModPath: () => 'datalocal',
  executable: () => 'GreedFall.exe',
  requiredFiles: ['GreedFall.exe'],
  environment: {
    SteamAPPId: '606880',
  },
  details:
  {
    steamAppId: 606880,
  },
  setup: prepareForModding,
}

function main(context) {
  context.registerGame(gameParameters);
  context.registerInstaller('greedfall-mod', 25, testMod, installMod);

  context.once(() => {
    // after deployment update the modified time of all spk files to be current,
    // otherwise the game won't load them.
    context.api.onAsync('did-deploy', (profileId, deployment, setTitle) => {
      const state = context.api.store.getState();
      const profile = selectors.profileById(state, profileId);

      if (GAME_ID !== profile?.gameId) {
        return Promise.resolve();
      }

      const discovery = selectors.discoveryByGame(state, profile.gameId);
      const modDeployPath = modPath(discovery);

      const now = new Date();
      return Promise.map(deployment[''], file =>
        fs.utimesAsync(path.join(modDeployPath, file.relPath), now, now))
          .catch(err => context.api.showErrorNotification(
            'Failed to change file access/modified time', err, { allowReport: false }));
    });
  });

  return true;
}

module.exports = {
  default: main
};
