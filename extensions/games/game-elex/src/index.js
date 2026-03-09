const path = require('path');
const { fs, util } = require('vortex-api');

// Nexus Mods id for the game.
const ELEX_ID = 'elex';

// All Elex mods will be .pak files
const MOD_FILE_EXT = ".pak";

function findGame() {
  return util.steam.findByAppId('411300')
      .then(game => game.gamePath);
}

function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(path.join(discovery.path, 'data', 'packed'),
    () => Promise.resolve());
}

function installContent(files) {
  // The .pak file is expected to always be positioned in the mods directory we're going to disregard anything placed outside the root.
  const modFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT);
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);
  
  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(file => 
    ((file.indexOf(rootPath) !== -1) 
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file.substr(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

function testSupportedContent(files, gameId) {
  // Make sure we're able to support this mod.
  let supported = (gameId === ELEX_ID) &&
    (files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined);

  if (supported && files.find(file =>
      (path.basename(file).toLowerCase() === 'moduleconfig.xml')
      && (path.basename(path.dirname(file)).toLowerCase() === 'fomod'))) {
    supported = false;
  }

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function main(context) {
  context.registerGame({
    id: ELEX_ID,
    name: 'Elex',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: [],
    queryModPath: () => path.join('data', 'packed'),
    logo: 'gameart.jpg',
    executable: () => path.join('system', 'ELEX.exe'),
    requiredFiles: [
      path.join('system', 'ELEX.exe'),
    ],
    setup: prepareForModding,
    environment: {
      SteamAPPId: '411300',
    },
    details: {
      steamAppId: 411300,
    },
  });

  context.registerInstaller('elex-mod', 25, testSupportedContent, installContent);

  return true;
}

module.exports = {
  default: main,
};
