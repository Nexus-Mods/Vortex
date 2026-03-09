const Promise = require('bluebird');
const path = require('path');
const winapi = require('winapi-bindings');
const { fs, util } = require('vortex-api');

const { default: IniParser, WinapiFormat } = require('vortex-parse-ini');

const GAME_ID = 'vampirebloodlines';
const STEAM_ID = '2600';
const GOG_ID = '1207659240';

function readRegistryKey(hive, key, name) {
  try {
    const instPath = winapi.RegGetValue(hive, key, name);
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.resolve(undefined);
  }
}

function requiresLauncher(gamePath) {
  // VtM Bloodlines does not seem to have any steam specific files within
  //  the game's discovery path... Attempt to launch via Steam if
  //  we're able to retrieve the game's information via the Steam wrapper
  return util.steam.findByAppId(STEAM_ID.toString())
    .then(game => Promise.resolve({ launcher: 'steam' }))
    .catch(err => Promise.resolve(undefined));
}

function findGame() {
  return util.GameStoreHelper.findByAppId([STEAM_ID, GOG_ID])
    .then(game => game.gamePath)
    .catch(() => readRegistryKey('HKEY_LOCAL_MACHINE',
      `SOFTWARE\\WOW6432Node\\GOG.com\\Games\\${GOG_ID}`,
      'PATH'))
    .catch(() => readRegistryKey('HKEY_LOCAL_MACHINE',
      `SOFTWARE\\GOG.com\\Games\\${GOG_ID}`,
      'PATH'))
}

function prepareForModding(discovery) {
  return Promise.all(['Vampire', 'Unofficial_Patch'].map((modPath) => fs.ensureDirWritableAsync(path.join(discovery.path,modPath))));
}

function getUnofficialModPath(api) {
  const state = api.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  return path.join(discovery.path, 'Unofficial_Patch');
}

function isUPModType(api, instructions) {
  return fs.readdirAsync(getUnofficialModPath(api))
    .then((dirEntries) => (dirEntries.length > 0)
      ? Promise.resolve(true)
      : Promise.resolve(false))
    .catch(() => Promise.resolve(false));
}

function getGameVersion(discoveryPath) {
  const parser = new IniParser(new WinapiFormat());
  return parser.read(path.join(discoveryPath, 'version.inf'))
    .then((data) => {
      const version = data?.data?.['Version Info']?.ExtVersion;
      return (version)
        ? Promise.resolve(version)
        : Promise.reject(new util.DataInvalid('Invalid version file'))
    });
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Vampire the Masquerade\tBloodlines',
    shortName: 'VTMB',
    logo: 'gameart.jpg',
    mergeMods: true,
    queryPath: findGame,
    requiresLauncher,
    getGameVersion,
    queryModPath: () => 'Vampire',
    executable: () => 'Vampire.exe',
    requiredFiles: [
      'Vampire.exe'
    ],
    environment: {
      SteamAPPId: STEAM_ID,
    },
    details: {
      steamAppId: +STEAM_ID,
    },
    setup: prepareForModding,
  });

  // The "unofficial patch" mod modifies the mods folder. GoG seems to include
  //  this by default ?
  context.registerModType('vtmb-up-modtype', 25,
    (gameId) => gameId === GAME_ID, () => getUnofficialModPath(context.api),
    (instructions) => isUPModType(context.api, instructions));
}

module.exports = {
  default: main
};
