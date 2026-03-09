const path = require('path');
const semver = require('semver');
const rjson = require('relaxed-json');
const { fs, log, util } = require('vortex-api');

const { getFileVersion, getProductVersion } = require('exe-version');

const { GAME_ID, BAS_DB } = require('./common');

// The global file holds current gameversion information
//  we're going to use this to compare against a mod's expected
//  gameversion and inform users of possible incompatibility.
//  (The global file is located in the game's StreamedAssets/Default path)
//  *** U6 BACKWARDS COMPATIBILITY ***
const GLOBAL_FILE = 'global.json';

// The global file has been renamed to Game.json in update 7.
//  going to temporarily keep Global.json for backwards compatibility.
const GAME_FILE = 'game.json';

async function getJSONElement(filePath, element) {
  return fs.readFileAsync(filePath, { encoding: 'utf-8' })
    .then(data => {
      try {
        const modData = rjson.parse(util.deBOM(data));
        const elementData = util.getSafe(modData, [element], undefined);
        return elementData !== undefined
          ? Promise.resolve(elementData)
          : Promise.reject(new util.DataInvalid(`"${element}" JSON element is missing`));
      } catch (err) {
        return ((err.message.indexOf('Unexpected end of JSON input') !== -1)
             || (err.name.indexOf('SyntaxError') !== -1))
          ? Promise.reject(new util.DataInvalid('Invalid manifest.json file'))
          : Promise.reject(err);
      }
    });
}

async function getModName(manifestFilePath, element, ext) {
  // The game itself is expecting the folder name of the mod
  //  to be added to the load order file - the game does not read the manifest
  //  which will probably have to change one day if some sort of mod dependencies
  //  system is needed (cross that bridge when we get to it)
  //
  //  In 8.4 bundled assets need to specify the exact location of their assets.
  //  Our understanding of the bundler was that it automatically generates the
  //  manifest file using the paths they defined for their assets, but apparently
  //  that's only partly true as the mod author needs to copy/paste the resulting
  //  folder names into the manifest file's name property (which gives them the
  //  chance to change the name to whatever they want) e.g.
  //  https://www.nexusmods.com/bladeandsorcery/mods/3064
  //
  //  Hence we have no choice but to temporarily dumb down how we ascertain the
  //  mod's name and use whatever folder name the mod authors included in their
  //  archive - if there is one.
  //
  //  tldr: we're putting this hack in because mod authors appear to
  //  modify the name of the mod in the manifest file, creating a mismatch between
  //  asset paths and the manifest.
  const folderName = path.basename(path.dirname(manifestFilePath));
  let modName = (path.extname(folderName) === '.installing')
    // The mod's files are distributed looseley - no folder - read manifest.
    ? await getJSONElement(manifestFilePath, element)
    // The mod author included a mod folder - use that as the mod name.
    : folderName;

  if (modName === undefined) {
    throw new util.DataInvalid(`"${element}" JSON element is missing`);
  }

  if (!util.isFilenameValid(modName)) {
    throw new util.DataInvalid(
      "Mod name invalid. Starting with game version 8.4, mod names have to be valid file names.");
  }

  return (ext !== undefined)
    ? path.basename(modName, ext)
    : modName;
}

async function findGameConfig(discoveryPath) {
  const findConfig = (searchPath) => fs.readdirAsync(searchPath)
    .catch(err => {
      return ['ENOENT', 'ENOTFOUND'].includes(err.code)
        ? Promise.resolve([])
        : Promise.reject(err);
    })
    .then(entries => {
      const configFile = entries.find(file => (file.toLowerCase() === GAME_FILE)
        || (file.toLowerCase() === GLOBAL_FILE));
      return (configFile !== undefined)
        ? Promise.resolve(path.join(searchPath, configFile))
        : Promise.reject(new util.NotFound('Missing game.json config file.'));
    });
  const basePath = path.join(discoveryPath, streamingAssetsPath(), 'Default');
  try {
    const configPath = await extractBaSDB(discoveryPath);
    return findConfig(configPath);
  } catch (err) {
    // Backwards compatibility for pre U10
    return findConfig(path.join(basePath, 'Bas'))
      .catch(err => findConfig(basePath));
  }
}

// Returns the path to the game.json file
async function extractBaSDB(discoveryPath) {
  const basePath = path.join(discoveryPath, streamingAssetsPath(), 'Default');
  const basArc = path.join(basePath, BAS_DB);
  try {
    await fs.statAsync(path.join(basePath, GAME_FILE));
    // game.json file is already there.
    return basePath;
  } catch (err) {
    // game.json isn't there - extract it.
    try {
      const seven = new util.SevenZip();
      await seven.extract(basArc, basePath, { raw: ['Game.json'] });
      return basePath;
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

async function getGameVersion(discoveryPath, execFile) {
  const gameVer = getFileVersion(path.join(discoveryPath, execFile));
  if (gameVer.match(/^20[0-9][0-9]/)) {
    const configFile = await findGameConfig(discoveryPath);
    let gameVersion = await getJSONElement(configFile, 'gameVersion');
    return gameVersion.toString().replace(',', '.');
  } else {
    return gameVer;
  }
}

async function getMinModVersion(discoveryPath, execFile) {
  const prodVer = getProductVersion(path.join(discoveryPath, execFile));
  if (prodVer.match(/^20[0-9][0-9]/)) {
    const configFile = await findGameConfig(discoveryPath);
    try {
      const version = await getJSONElement(configFile, 'minModVersion');
      return { version, majorOnly: false };
    } catch (err) {
      if (err.message.indexOf('JSON element is missing') !== -1) {
        const version = await getJSONElement(configFile, 'gameVersion');
        return { version, majorOnly: true };
      } else {
        throw err;
      }
    }
  } else {
    return { version: prodVer, majorOnly: false };
  }
}

async function checkModGameVersion(destination, minModVersion, modFile) {
  const coercedMin = semver.coerce(minModVersion.version);
  const minVersion = minModVersion.majorOnly
    ? coercedMin.major + '.x'
    : `>=${coercedMin.version}`;
  try {
    let modVersion = await getJSONElement(path.join(destination, modFile), 'GameVersion');
    modVersion = modVersion.toString().replace(',', '.');
    const coercedMod = semver.coerce(modVersion.toString());
    if (coercedMod === null) {
      return Promise.reject(new util.DataInvalid('Mod manifest has an invalid GameVersion element'));
    }

    return Promise.resolve({
      match: semver.satisfies(coercedMod.version, minVersion),
      modVersion: coercedMod.version,
      globalVersion: coercedMin.version,
    });
  } catch (err) {
    return Promise.reject(err);
  }
}

function getDiscoveryPath(api) {
  const store = api.store;
  const state = store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if ((discovery === undefined) || (discovery.path === undefined)) {
    // should never happen and if it does it will cause errors elsewhere as well
    log('debug', 'bladeandsorcery was not discovered');
    return undefined;
  }

  return discovery.path;
}

function missingGameJsonError(api, err) {
  if (err instanceof util.NotFound) {
    api.sendNotification({
      id: 'missing-game-json',
      type: 'error',
      message: 'Missing Game.json file',
      actions: [
        { title: 'More', action: (dismiss) =>
          api.showDialog('info', 'Missing Game.json file', {
            text: api.translate('Your game copy is missing its Game.json file, please try running the game at least once, or re-install the game.')
          }, [ { label: 'Close', action: () => dismiss() } ])
        },
      ],
    })
    return Promise.reject(new util.ProcessCanceled('Missing Game.json file'));
  } else {
    return Promise.reject(err);
  }
}

function streamingAssetsPath() {
  return path.join('BladeAndSorcery_Data', 'StreamingAssets');
}

function isOfficialModType(modType) {
  return ['bas-legacy-modtype', 'bas-official-modtype'].includes(modType)
}

module.exports = {
  getModName,
  getJSONElement,
  getGameVersion,
  getMinModVersion,
  getDiscoveryPath,

  checkModGameVersion,
  isOfficialModType,
  streamingAssetsPath,
  missingGameJsonError,
}