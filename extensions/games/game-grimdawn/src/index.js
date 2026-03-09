const path = require('path');
const { fs, util } = require('vortex-api');
const winapi = require('winapi-bindings');

const GAME_ID = 'grimdawn';

function findGame() {
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1449651388',
      'path');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
  return util.steam.findByName('Grim Dawn')
    .then(game => game.gamePath);
  }
}

function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(path.join(discovery.path, 'mods'),
                                   () => Promise.resolve());
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Grim Dawn',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: [],
    setup: prepareForModding,
    queryModPath: () => 'mods',
    logo: 'gameart.jpg',
    executable: () => 'Grim Dawn.exe',
    requiredFiles: [
      'Grim Dawn.exe',
    ],
    environment: {
      SteamAPPId: '219990',
    },
    details: {
      steamAppId: 219990,
      hashFiles: ['Grim Dawn.exe', 'Game.dll'],
    }
  });

  return true;
}

module.exports = {
  default: main
};
