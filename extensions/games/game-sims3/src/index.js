const Promise = require('bluebird');
const { remote } = require('electron');
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
      'Software\\WOW6432Node\\Sims\\The Sims 3',
      'Install Dir');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.reject(err);
  }
}

const resource = `Priority 500
PackedFile DCCache/*.dbc
PackedFile Packages/*.package
PackedFile Packages/*/*.package
PackedFile Packages/*/*/*.package
PackedFile Packages/*/*/*/*.package
PackedFile Packages/*/*/*/*/*.package
`;

function prepareForModding() {
  const basePath = modPath();
  const resPath = path.join(path.dirname(basePath), 'Resource.cfg');
  return fs.ensureDirAsync(basePath)
    .then(() => fs.statAsync(resPath))
    .catch(() => fs.writeFileAsync(resPath, resource, { encoding: 'utf-8' }));
}

function modPath() {
  return path.join(remote.app.getPath('documents'), 'Electronic Arts', 'The Sims 3', 'Mods', 'Packages');
}

let tools = [];

async function getGameVersion(gamePath) {
  const skuInfo = await fs.readFileAsync(path.join(gamePath, 'game', 'bin', 'skuversion.txt'), { encoding: 'utf8' });
  const gvLine = skuInfo.split('\n').find(line => line.startsWith('GameVersion'));
  if (gvLine !== undefined) {
    return gvLine.split('=')[1].trim();
  } else {
    throw new Error('failed to parse skuversion.txt');
  }
}

function main(context) {
  context.registerGame({
    id: 'thesims3',
    name: 'The Sims 3',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.jpg',
    executable: () => 'game/bin/TS3.exe',
    getGameVersion,
    requiredFiles: [
      'game/bin/TS3.exe',
    ],
    supportedTools: tools,
    setup: prepareForModding,
    details: {
      steamAppId: 47890,
    },
  });
  return true;
}

module.exports = {
  default: main,
};
