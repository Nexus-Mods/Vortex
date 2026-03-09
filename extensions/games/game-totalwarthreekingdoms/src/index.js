const path = require('path');
const { fs, log, util } = require('vortex-api');

const TW3KINDOMS_ID = 'totalwarthreekingdoms';
const STEAMAPP_ID = '779340';
const EPICAPP_ID = '769f2fee68e9477180da900ccccbbcf0';
const GOGAPP_ID = '1717887914';
const EXEC = 'Three_Kingdoms.exe';
const EXEC_LAUNCHER = 'Launcher.exe';
const MOD_FILE_EXT = ".pack";

let tools = [
  {
    id: 'TW3KingdomsTweak',
    name: 'Tweak',
    logo: 'gameart.jpg',
    executable: () => 'assembly_kit/binaries/Tweak.retail.x64.exe',
    relative: true,
    requiredFiles: [
      'assembly_kit/binaries/Tweak.retail.x64.exe'
    ],
  },
  {
    id: 'TW3KingdomsBOB',
    name: 'B.O.B.',
    logo: 'gameart.jpg',
    executable: () => 'assembly_kit/binaries/BoB.retail.x64.exe',
    relative: true,
    requiredFiles: [
      'assembly_kit/binaries/BoB.retail.x64.exe'
    ],
  }
]

function findGame() {
  return () => util.GameStoreHelper.findByAppId([STEAMAPP_ID, EPICAPP_ID, GOGAPP_ID])
    .then((game) => game.gamePath);
}

async function requiresLauncher(gamePath, store) {
  if (store === 'epic') {
    return Promise.resolve({
        launcher: 'epic',
        addInfo: {
            appId: EPICAPP_ID,
        },
    });
  } //*/
  /*
  if (store === 'steam') {
    return Promise.resolve({
        launcher: 'steam',
    });
  } //*/
  return Promise.resolve(undefined);
}

function statCheckSync(gamePath, file) {
  try {
    fs.statSync(path.join(gamePath, file));
    return true;
  }
  catch (err) {
    return false;
  }
}

//Get correct executable for game version
function getExecutable(discoveryPath) {
  if (statCheckSync(discoveryPath, EXEC_LAUNCHER)) {
    return EXEC_LAUNCHER;
  };
  return EXEC;
}

function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(path.join(discovery.path, 'data'),
    () => Promise.resolve());
}

function installContent(files) {
  // The .pack file is expected to always be positioned in the data directory we're going to disregard anything placed outside the root.
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
  const supported = (gameId === TW3KINDOMS_ID) &&
    (files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined);
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function main(context) {
  context.registerGame({
    id: TW3KINDOMS_ID,
    name: 'Total War: Three Kingdoms',
    shortName: 'TW 3 Kingdoms',
    mergeMods: true,
    queryPath: findGame(),
    supportedTools: tools,
    queryModPath: () => 'data',
    logo: 'gameart.jpg',
    executable: getExecutable,
    requiredFiles: [
      EXEC
    ],
    setup: prepareForModding,
    requiresLauncher: requiresLauncher,
    environment: {
      SteamAPPId: STEAMAPP_ID,
    },
    details: {
      steamAppId: +STEAMAPP_ID,
    },
  });

  context.registerInstaller('tw3kingdoms-mod', 25, testSupportedContent, installContent);

  return true;
}

module.exports = {
  default: main,
};
