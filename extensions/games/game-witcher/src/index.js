const Promise = require('bluebird');
const path = require('path');
const { fs, util } = require('vortex-api');
const winapi = require('winapi-bindings');

function findGame() {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Currently only discovered on windows'));
  }
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\CD Project Red\\Witcher',
      'InstallFolder');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.steam.findByName('The Witcher: Enhanced Edition Director\'s Cut')
      .catch(() => util.steam.findByAppId('20900'))
      .then(game => game.gamePath);
  }
}

function testUserContent(instructions) {
  return Promise.resolve(instructions.find(instruction =>
    (instruction.type === 'copy')
      && (path.basename(instruction.destination) === 'cook.hash')) !== undefined);
}

function prepareForModding(discovery) {
  return fs.ensureDirAsync(path.join(discovery.path, 'Data', 'Override'));
}

function gameExecutable() {
  return 'system/witcher.exe';
}

function main(context) {
  context.registerGame({
    id: 'witcher',
    name: 'The Witcher',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: [],
    queryModPath: () => 'Data/Override',
    logo: 'gameart.jpg',
    executable: gameExecutable,
    setup: prepareForModding,
    requiredFiles: [
      gameExecutable(),
    ],
    environment: {
      SteamAPPId: '20900',
    },
    details: {
      steamAppId: 20900,
    }
  });

  const getPath = (game) => {
    const state = context.api.store.getState();
    const discovery = state.settings.gameMode.discovered[game.id];
    return path.join(discovery.path, 'Data', 'Override');
  };

  context.registerModType('witcheruser', 25, gameId => gameId === 'witcher', getPath, testUserContent);

  return true;
}

module.exports = {
  default: main,
};
