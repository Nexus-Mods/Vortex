const Promise = require('bluebird');
const { app, remote } = require('electron');
const _ = require('lodash');
const path = require('path');
const { fs, log, selectors, util } = require('vortex-api');
const { Builder, parseStringPromise } = require('xml2js');

const appUni = remote !== undefined ? remote.app : app;

const GAME_ID = 'wolcenlordsofmayhem';
const APPID = 424370;

// These help Vortex install mods correctly. This list should contain directories and files
// that are expected to appear in the top-level of the mod directory (Wolcen\Game)
// Vortex can use that information to figure out the correct location to install mods into
const STOP_PATTERNS = ['levels', 'Lib', 'Loot', 'Objects', 'Umbra'];

function toWordExp(input) {
  return '(^|/)' + input + '(/|$)';
}

function findGame() {
  return util.steam.findByAppId(APPID.toString())
      .then(game => game.gamePath);
}

function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(path.join(discovery.path, 'Mods'), () => Promise.resolve());
}

function gameExecutable() {
  return path.join('win_x64', 'Wolcen.exe');
}

function isXML(filePath) {
  return ['.xml', '.mtl'].includes(path.extname(filePath).toLowerCase());
}

function makeTestMerge(api) {
  return (game, gameDiscovery) => {
    if (game.id !== GAME_ID) {
      return undefined;
    }

    const installPath = selectors.installPathForGame(api.store.getState(), game.id);

    return {
      baseFiles: (deployedFiles) => deployedFiles
        .filter(file => isXML(file.relPath))
        .map(file => ({
          in: path.join(installPath, file.source, file.relPath),
          out: file.relPath,
        })),
      filter: filePath => isXML(filePath),
    };
  }
}

async function readCryXML(filePath) {
  const data = await fs.readFileAsync(filePath);
  if (data.utf8Slice(0, 6) === 'CryXml') {
    // why do people even package this???
    throw new util.ProcessCanceled('encrypted xml');
  }
  return await parseStringPromise(data);
}

async function getBaseData(targetPath) {
  // TODO: this would require us to decrypt and unpack the source game files
  return undefined;
}

async function getTargetData(targetPath) {
  try {
    return await readCryXML(targetPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return undefined;
    }
    err.message = `Failed to parse "${targetPath}": ${err.message}`;
    log('error', 'failed to read xml file',
      { targetPath, error: err.message, name: err.name, type: err.prototype.name });
    throw err;
  }
}

/**
 * 
 * @param {import('vortex-api/lib/types/IExtensionContext').IExtensionApi} api 
 * @returns 
 */
function makeMergeXML(api) {
  return async (filePath, mergePath) => {
    const installPath = selectors.installPathForGame(api.store.getState(), GAME_ID);

    const relPath = path.relative(installPath, filePath).split(path.sep).slice(1).join(path.sep);

    const targetPath = path.join(mergePath, relPath);

    await fs.ensureDirAsync(path.dirname(targetPath));

    try {
      const baseData = await getBaseData(targetPath);
      const targetData = await getTargetData(targetPath);
      const modData = await readCryXML(filePath);

      const builder = new Builder();
      if (targetData === undefined) {
        // no existing data, just use the mod file
        await fs.writeFileAsync(targetPath, builder.buildObject(modData));
      } else if (baseData === undefined) {
        // no reference data, simply merge the mod data onto target
        // this may overwrite more data than intended
        _.merge(targetData, modData);
        await fs.writeFileAsync(targetPath, builder.buildObject(targetData));
      } else {
        // three way merge possible
        // TODO util.apply is not actually implemented yet
        throw new Error('not implemented yet');
        /*
        const diff = util.objDiff(baseData, modData);
        util.apply(targedData, diff);
        */
      }
    } catch (err) {
      if (!(err instanceof util.ProcessCanceled)) {
        api.showErrorNotification(
          'Failed to merge xml file, this indicates a bug in the mod owning this file',
          err,
          {
            allowReport: false,
            message: relPath,
          })
      }
    }
  }
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Wolcen:\tLords Of Mayhem',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'Game',
    logo: 'gameart.jpg',
    executable: gameExecutable,
    requiredFiles: [
      gameExecutable(),
    ],
    setup: prepareForModding,
    environment: {
      SteamAPPId: APPID.toString(),
    },
    details: {
      steamAppId: APPID,
      stopPatterns: STOP_PATTERNS.map(toWordExp),
    },
  });

  context.registerMerge(makeTestMerge(context.api), makeMergeXML(context.api), '');

  return true;
}

module.exports = {
  default: main,
};
