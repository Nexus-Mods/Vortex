const path = require('path');
const Promise = require('bluebird');
const { fs, util } = require('vortex-api');

const { parseStringPromise } = require('xml2js');

const GAME_ID = 'rimworld';
const STEAM_DLL = 'steam_api64.dll'
const ABOUT_XML_FILE = 'about.xml';
const GIT_FILES = [
  '.gitignore', '.gitattributes'
];

const ROOT_FOLDER_FILES = [
  'README.MD', 'LICENSE', 'CONTRIBUTING.MD'
];

function findGame() {
  return util.steam.findByAppId('294100')
      .then(game => game.gamePath);
}

function requiresLauncher(gamePath) {
  return fs.readdirAsync(gamePath)
    .then(files => (files.find(file => file.endsWith(STEAM_DLL)) !== undefined)
      ? Promise.resolve({ launcher: 'steam' })
      : Promise.resolve(undefined))
    .catch(err => Promise.reject(err));
}

function resolveGameVersion(discoveryPath) {
  const versionPath = path.join(discoveryPath, 'version.txt');
  return fs.readFileAsync(versionPath, { encoding: 'utf8' })
    .then((res) => Promise.resolve(res));
}

async function getModName(aboutFilePath) {
  try {
    const fileData = await fs.readFileAsync(aboutFilePath, { encoding: 'utf8' });
    const parsed = await parseStringPromise(fileData);
    return Promise.resolve(parsed.ModMetaData.packageId[0]);
  } catch (err) {
    return Promise.resolve(undefined);
  }
}

function testSupportedSteamMod(api, files, gameId, archivePath) {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  const aboutFiles = files.filter(file => path.basename(file).toLowerCase() === ABOUT_XML_FILE);
  if (aboutFiles.length === 0) {
    // this installer doesn't handle bundles containing multiple such mods. Maybe we have
    // to treat those differently but I genuinely wouldn't know and have no way to test
    return Promise.resolve({ supported: false, requiredFiles: [] });
  } else if (aboutFiles.length > 1) {
    api.sendNotification({
      type: 'warning',
      message: 'The archive {{modName}} might not get installed correctly, please review the mod description and the staging folder for the mod.',
      replace: {
        modName: path.basename(archivePath),
      },
    });
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  return Promise.resolve({
    supported: true,
    requiredFiles: [],
  });
}

async function installSteamMod(files, destinationPath, gameId) {
  const aboutFile = files.find(file => path.basename(file).toLowerCase() === ABOUT_XML_FILE);
  const rootCandidate = files.find(file => ROOT_FOLDER_FILES.includes(path.basename(file)));
  const rootFile = rootCandidate ?? aboutFile;

  const segments = rootFile.split(path.sep);

  // modname based on the content of About.xml
  let modName = await getModName(path.join(destinationPath, aboutFile));
  if (modName === undefined) {
    modName = path.basename(destinationPath, '.installing');
  }
  modName = util.sanitizeFilename(modName).replace(/\./g, '_');

  // only files with extension that aren't git management files
  const filtered = files.filter(filePath =>
    !filePath.endsWith(path.sep)
    && (path.extname(path.basename(filePath)) !== '')
    && !GIT_FILES.includes(path.basename(filePath)));

  const instructions = filtered.map(file => {
    const fileSegments = file.split(path.sep);
    if ((fileSegments.length > 1) && (fileSegments[0] === segments[0])) {
      const destination = path.join(modName, fileSegments.slice(1).join(path.sep));
      return {
        type: 'copy',
        source: file,
        destination,
      };
    } else {
      return {
        type: 'copy',
        source: file,
        destination: file,
      };
    }
  });
  return Promise.resolve({ instructions });
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'RimWorld',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'Mods',
    logo: 'gameart.jpg',
    executable: () => 'RimWorldWin64.exe',
    requiredFiles: [
      'RimWorldWin64.exe'
    ],
    getGameVersion: resolveGameVersion,
    requiresLauncher,
    environment: {
      SteamAPPId: '294100',
    },
    details: {
      steamAppId: 294100,
    },
  });

  context.registerInstaller(
    'rimworld-steam-mod',
    25,
    (files, gameId, archivePath) => testSupportedSteamMod(context.api, files, gameId, archivePath),
    installSteamMod);

  return true;
}

module.exports = {
  default: main,
};
