// Star Wars: Knights of the Old Republic mods (kotor1 and kotor2) 
//  are usually extracted to the override folder found within the game's
//  directory. Most modders provide a full override directory structure
//  within their archive; in which case we will just copy over the 
//  contents of the override folder to the modPath.
//  
//  We will let the default installer to take over when the override structure
//  isn't detected.

const Promise = require('bluebird');
const path = require('path');
const winapi = require('winapi-bindings');
const { fs, selectors, util } = require('vortex-api');

const STEAM_DLL = 'steam_api.dll';

const OVERRIDE_FOLDER = 'override';

const TSL_FOLDER = 'tslpatchdata';
const GAME_FOLDERS = [
  'data', 'lips', 'miles', 'modules', 'movies', 'override', 'rims',
  'saves', 'streammusic', 'streamsounds', 'streamvoice', 'streamwaves',
  'texturepack',
];

const KOTOR_GAMES = {
  kotor: {
    id: 'kotor',
    shortName: 'Star Wars: KOTOR',
    name: 'STAR WARS™ - Knights of the Old Republic™',
    steamId: '32370',
    gogId: '1207666283',
    logo: 'gameart.jpg',
    exec: 'swkotor.exe',
  },
  kotor2: {
    id: 'kotor2',
    shortName: 'Star Wars: KOTOR II',
    name: 'STAR WARS™ Knights of the Old Republic™ II - The Sith Lords™',
    steamId: '208580',
    gogId: '1421404581',
    logo: 'gameartkotor2.jpg',
    exec: 'swkotor2.exe',
  },
}

function requiresLauncher(gamePath) {
  return fs.readdirAsync(gamePath)
    .then(files => files.find(file => file.indexOf(STEAM_DLL) !== -1) !== undefined 
      ? Promise.resolve({ launcher: 'steam' }) 
      : Promise.resolve(undefined))
    .catch(err => Promise.reject(err));
}

function readRegistryKey(hive, key, name) {
  try {
    const instPath = winapi.RegGetValue(hive, key, name);
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.reject(new util.ProcessCanceled(err));
  }
}

function findGame(kotorGame) {
  const { gogId, steamId } = kotorGame;
  return util.steam.findByAppId(steamId)
    .then(game => game.gamePath)
    .catch(() => readRegistryKey('HKEY_LOCAL_MACHINE',
      `SOFTWARE\\WOW6432Node\\GOG.com\\Games\\${gogId}`,
      'PATH'))
    .catch(() => readRegistryKey('HKEY_LOCAL_MACHINE',
      `SOFTWARE\\GOG.com\\Games\\${gogId}`,
      'PATH'));
}

function prepareForModding(discovery) {
  return fs.ensureDirAsync(path.join(discovery.path, OVERRIDE_FOLDER));
}

function isKotorGame(gameId) {
  return Object.keys(KOTOR_GAMES).includes(gameId);
}

function main(context) {
  Object.keys(KOTOR_GAMES).forEach(key => {
    const game = KOTOR_GAMES[key];
    context.registerGame({
      id: game.id,
      name: game.shortName,
      mergeMods: true,
      queryPath: () => findGame(game),
      queryModPath: () => OVERRIDE_FOLDER,
      requiresLauncher: game.id === 'kotor2' 
        ? requiresLauncher 
        : undefined,
      logo: game.logo,
      executable: () => game.exec,
      requiredFiles: [
        game.exec,
      ],
      environment: {
        SteamAPPId: game.steamId,
      },
      details: {
        steamAppId: parseInt(game.steamId, 10),
      },
      setup: prepareForModding,
    });
  })

  context.registerModType('kotor-root', 10, isKotorGame,
    () => {
      const state = context.api.getState();
      const gameMode = selectors.activeGameId(state);
      const discovery = selectors.discoveryByGame(state, gameMode);
      return discovery?.path;
    }, () => Promise.resolve(false), { name: 'Root Mod' });

  context.registerInstaller('kotor-tslpatcher', 10, testTSLSupported, () => installTSLContent(context.api));
  context.registerInstaller('kotor-tslpatcher-mod', 10, testTSLModSupported, () => installTSLModContent(context.api));
  context.registerInstaller('kotor-root-mod', 15, testRootSupported, installRootContent);
  context.registerInstaller('kotor-override-mod', 25, testSupported, installContent);

  return true;
}

function testRootSupported(files, gameId) {
  const isRootMod = files.find(file => {
    const segments = file.toLowerCase().split(path.sep);
    for (const seg of segments) {
      if (GAME_FOLDERS.includes(seg)) {
        return true;
      }
    }
    return false;
  });
  return Promise.resolve({
    supported: isRootMod && isKotorGame(gameId),
    requiredFiles: [],
  });
}

function installRootContent(files, destinationPath,
                            gameId, progressDelegate) {
  const modTypeInstr = {
    type: 'setmodtype',
    value: 'kotor-root',
  }

  const instructions = [modTypeInstr].concat(files.reduce((accum, file) => {
    if (!path.extname(file)) {
      return accum;
    }
    const segments = file.split(path.sep);
    const rootIdx = segments.findIndex(seg => GAME_FOLDERS.includes(seg.toLowerCase()));
    if (rootIdx === -1) {
      return accum;
    }

    const destination = segments.slice(rootIdx).join(path.sep);
    const source = file;
    accum.push({
      type: 'copy',
      source,
      destination,
    })
    return accum;
  }, []));
  return Promise.resolve({ instructions });
}

function testTSLModSupported(files, gameId) {
  const isTslPatcherMod = files.find(file => {
    const segments = file.toLowerCase().split(path.sep);
    return (segments.includes(TSL_FOLDER));
  }) !== undefined;
  return Promise.resolve({
    supported: isTslPatcherMod && isKotorGame(gameId),
    requiredFiles: [],
  });
}

function installTSLModContent(api) {
  api.showErrorNotification('Invalid Mod',
    'The mod you\'re installing is meant to be installed/run with the TSLPatcher tool - Vortex cannot install this mod', { allowReport: false });
  return Promise.reject(new util.ProcessCanceled('Invalid mod'));
}

function testTSLSupported(files, gameId) {
  const isTslPatcher = files.find(file => path.basename(file.toLowerCase()) === 'tslpatcher.exe') !== undefined;
  return Promise.resolve({
    supported: isTslPatcher && isKotorGame(gameId),
    requiredFiles: [],
  });
}

function installTSLContent(api) {
  api.showErrorNotification('Invalid Mod',
    'Vortex cannot install TSLPatcher as a mod - this is a separate utility application which should be installed and used separately.', { allowReport: false });
  return Promise.reject(new util.ProcessCanceled('Invalid mod'));
}

function installContent(files,
                destinationPath,
                gameId,
                progressDelegate) {
  // Copy over everything
  const instructions = files
    .filter(file => path.extname(file) !== '')
    .map(file => {
      return {
        type: 'copy',
        source: file,
        destination: file,
      };
    });

  return Promise.resolve({ instructions });
}

function testSupported(files, gameId) {
  // Everything else is going in the override folder
  return Promise.resolve({
    supported: isKotorGame(gameId),
    requiredFiles: [],
  });
}

module.exports = {
  default: main
};
