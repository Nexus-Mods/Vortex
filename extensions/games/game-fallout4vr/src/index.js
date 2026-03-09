const Promise = require('bluebird');
const path = require('path');
const {getFileVersion} = require('exe-version');
const { util } = require('vortex-api');
const winapi = require('winapi-bindings');

/* 
Ignore the Meshes\AnimTextData\AnimationOffsets\PersistantSubgraphInfoAndOffsetData.txt file as a conflict. 
It's present in a lot of weapon mods but doesn't matter if it's overwritten. 
This issue is compounded by users extracting all their BA2s. 
*/
const IGNORED_FILES = [ path.join('**', 'PersistantSubgraphInfoAndOffsetData.txt') ];

function findGame() {
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\Wow6432Node\\Bethesda Softworks\\Fallout 4 VR',
      'Installed Path');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.steam.findByName('Fallout 4 VR')
      .then(game => game.gamePath);
  }
}

function getGameVersion(gamePath, exePath) {
  const fullPath = path.join(gamePath, exePath);
  const fileVersion = getFileVersion(fullPath);

  return fileVersion + '-VR';
}

let tools = [
  {
    id: 'FO4VREdit',
    name: 'FO4VREdit',
    logo: 'fo3edit.png',
    executable: () => 'FO4VREdit.exe',
    requiredFiles: [
      'FO4VREdit.exe',
    ],
  },
  {
    id: 'F4SEVR',
    name: 'F4SE VR',
    executable: () => 'f4sevr_loader.exe',
    requiredFiles: [
      'f4sevr_loader.exe',
    ],
    defaultPrimary: true
  },
];

function main(context) {
  context.registerGame({
    id: 'fallout4vr',
    name: 'Fallout 4 VR',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'Data',
    logo: 'gameart.jpg',
    executable: () => 'Fallout4VR.exe',
    getGameVersion,
    requiredFiles: [
      'Fallout4VR.exe',
    ],
    environment: {
      SteamAPPId: '611660',
    },
    details: {
      steamAppId: 611660,
      compatibleDownloads: ['fallout4'],
      ignoreConflicts: IGNORED_FILES,
      nexusPageId: 'fallout4',
    }
  });

  return true;
}

module.exports = {
  default: main,
};
