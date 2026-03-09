const Promise = require('bluebird');
const path = require('path');
const { fs } = require('vortex-api');
const winapi = require('winapi-bindings');

function findGame() {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Currently only discovered on windows'));
  }
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\CD Project Red\\The Witcher 2',
      'InstallFolder');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.reject(err);
  }
}

function testUserContent(instructions) {
  return Promise.resolve(instructions.find(instruction =>
    (instruction.type === 'copy')
      && (path.basename(instruction.destination) === 'cook.hash')) !== undefined);
}

function prepareForModding(discovery) {
  return fs.ensureDirAsync(path.join(discovery.path, 'UserContent'));
}

function main(context) {
  var win32 = process.platform === 'win32';
  context.registerGame({
    id: 'witcher2',
    name: 'The Witcher 2',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: [],
    queryModPath: () => 'CookedPC',
    logo: 'gameart.jpg',
    executable: win32 ?
      () => 'bin/witcher2.exe' :
      () => 'launcher',
    setup: prepareForModding,
    requiredFiles: win32 ? [
      'bin/witcher2.exe',
      'bin/userContentManager.exe',
    ] : [
      'launcher',
      'saferun.sh',
      'tenfoot-launcher',
      'desktop-launcher',
    ],
    details: {
      steamAppId: 20920,
    }
  });

  const getPath = (game) => {
    const state = context.api.store.getState();
    const discovery = state.settings.gameMode.discovered[game.id];
    return path.join(discovery.path, 'UserContent');
  };

  context.registerModType('witcher2user', 25, gameId => gameId === 'witcher2', getPath, testUserContent);

  return true;
}

module.exports = {
  default: main,
};
