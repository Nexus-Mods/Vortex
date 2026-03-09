const path = require('path');
const { fs, log, util } = require('vortex-api');

// Nexus Mods id for the game.
const AHATINTIME_ID = 'ahatintime';

// All AHiT mods are expected to have this file in the mod's
//  root folder.
const MOD_INFO = 'modinfo.ini';

let tools = [
  {
    id: 'HatinTimeEditor',
    name: 'Modding Tools',
    logo: 'HatinTimeEditor.png',
    executable: () => 'Binaries/ModManager.exe',
    requiredFiles: [
      'Binaries/ModManager.exe',
    ],
  }
]

function findGame() {
  return util.steam.findByAppId('253230')
      .then(game => game.gamePath);
}

function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(path.join(discovery.path, 'HatInTimeGame/Mods'),
    () => Promise.resolve());
}

function installContent(files,
                        destinationPath,
                        gameId,
                        progressDelegate) {
  // The modinfo.ini file is expected to always be positioned in the root directory
  //  of the mod itself; we're going to disregard anything placed outside the root.
  const modFile = files.find(file => path.basename(file) === MOD_INFO);
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);
  const modName = (rootPath !== '')
    ? rootPath
    : path.basename(destinationPath, '.installing');

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(file => 
    ((file.indexOf(rootPath) !== -1) 
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(modName, file.substr(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

function testSupportedContent(files, gameId) {
  // Make sure we're able to support this mod.
  const supported = (gameId === AHATINTIME_ID) &&
    (files.find(file => path.basename(file) === MOD_INFO) !== undefined);
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function main(context) {
  context.registerGame({
    id: AHATINTIME_ID,
    name: 'A Hat in Time',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'HatInTimeGame/Mods',
    logo: 'gameart.jpg',
    executable: () => 'Binaries/Win64/HatInTimeGame.exe',
    requiredFiles: [
      'Binaries/Win64/HatInTimeGame.exe',
    ],
    setup: prepareForModding,
    environment: {
      SteamAPPId: '253230',
    },
    details: {
      steamAppId: 253230,
    },
  });

  context.registerInstaller('ahatintime-mod', 25, testSupportedContent, installContent);

  return true;
}

module.exports = {
  default: main,
};
