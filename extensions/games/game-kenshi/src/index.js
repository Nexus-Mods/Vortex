const path = require('path');
const { fs, util } = require('vortex-api');

const STEAM_DLL = 'steam_api.dll';

// Nexus Mods id for the game.
const KENSHI_ID = 'kenshi';
const STEAM_EXE = 'kenshi_x64.exe';
const GOG_EXE = 'kenshi_GOG_x64.exe';

const VERSION_FILE = 'currentVersion.txt';

// The mod file is expected to be at the root of the mod
const MOD_FILE_EXT = '.mod';

function findGame() {
  return util.steam.findByAppId('233860')
      .then(game => game.gamePath);
}
let tools = [
  {
    id: 'nvidiaProfileInspector',
    name: 'Darkmod inspector',
    logo: 'Nvidia logo.png',
    executable: () => 'nvidiaProfileInspector.exe',
    requiredFiles: [
      'nvidiaProfileInspector.exe',
      'nvidiaProfileInspector.pdb',
      'CustomColors.xml',
      'Reference.xml'
    ],
  },
  {
    id: 'WOCS.Patcher.Scar.PathFinding fix',
    name: 'OCS.Patcher.Scar.PathFinding fix',
    logo: 'OCS logo.png',
    executable: () => 'OCS.Patcher.Scar.PathFinding.Steam.exe',
    requiredFiles: [
      'OCS.Patcher.Scar.PathFinding.exe',
      'OpenConstructionSet.dll',
    ],
  },
];
function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(path.join(discovery.path, 'mods'),
    () => Promise.resolve());
}

// Kenshi's Steam version requires the game to be executed
//  via Steam in order for it to add workshop mods.
function requiresLauncher(gamePath, store) {

    return store === 'steam' ?  Promise.resolve({ launcher: 'steam' }) : Promise.resolve(undefined);
}

function installContent(files) {
  // The .mod file is expected to always be positioned in the root directory
  //  of the mod itself; we're going to disregard anything placed outside the root.
  const modFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT);
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);

  // The mod folder MUST match the mod file (without the extension).
  const modName = path.basename(modFile, MOD_FILE_EXT);
  
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
  const supported = (gameId === KENSHI_ID) &&
    (files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined);
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function getExecutable(discoveryPath) {
  if (discoveryPath === undefined) {
    return STEAM_EXE;
  }

  let execFile = GOG_EXE;
  try {
    fs.statSync(path.join(discoveryPath, GOG_EXE))
  } catch (err) {
    execFile = STEAM_EXE;
  }

  return execFile;
}

function getGameVersion(discoveryPath) {
  return fs.readFileAsync(path.join(discoveryPath, VERSION_FILE), { encoding: 'utf8' })
    .then(res => Promise.resolve(res.split(' ')[1]));
}

function main(context) {
context.registerGame({
    id: KENSHI_ID,
    name: 'Kenshi',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'mods',
    logo: 'gameart.jpg',
    executable: (discoveryPath) => getExecutable(discoveryPath),
    getGameVersion,
    supportedToos: tools, // Assign the tools in the registerGame API call
    requiredFiles: [
      'OgreMain_x64.dll',
      path.join('data', 'kenshi.ico'),
    ],
    setup: prepareForModding,
    requiresLauncher,
    environment: {
      SteamAPPId: '233860',
    },
    details: {
      steamAppId: 233860,
    },
  });

  context.registerInstaller('kenshi-mod', 25, testSupportedContent, installContent);

  return true;
}

module.exports = {
  default: main,
};
