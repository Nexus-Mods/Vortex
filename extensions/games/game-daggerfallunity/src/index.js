const { app, remote } = require('electron');
const path = require('path');
const { fs, util } = require('vortex-api');

const appUni = app || remote.app;
const LOCAL_LOW = path.resolve(appUni.getPath('appData'),
  '..', 'LocalLow', 'Daggerfall Workshop', 'Daggerfall Unity');
const ENV_LOG = path.join(LOCAL_LOW, 'DFTFU_Environment.log');
const GAME_ID = 'daggerfallunity';
const GAME_EXEC = 'DaggerfallUnity.exe';
const CMD_PATTERN = 'CommandLine | ';
const VERSION_PATTERN = 'Version | ';
const DFMOD_EXT = '.dfmod';

function resolveGameVersion() {
  return fs.readFileAsync(ENV_LOG, { encoding: 'utf8' })
    .then(data => {
      const match = data.match(/^Version \| [0-9].[0-9].*/gm);
      return (match)
        ? Promise.resolve(match[0].substr(VERSION_PATTERN.length).trim())
        : Promise.reject(new util.DataInvalid('Unable to resolve game version'));
    });
}

function findGame() {
  const getTrimmedPath = (gamePath) => {
    const trimmed = gamePath.substr(CMD_PATTERN.length).trim().replace(/\"/g, '');
    return path.dirname(trimmed);
  }

  return fs.readFileAsync(ENV_LOG, { encoding: 'utf8' })
    .then(data => {
      const lines = data.split(/\n/gm);
      const gamePathLine = lines.find(line => line.indexOf(GAME_EXEC) !== -1);
      return (gamePathLine !== undefined)
        ? Promise.resolve(getTrimmedPath(gamePathLine))
        : Promise.resolve(undefined);
    })
    .catch(err => (err['code'] === 'ENOENT')
      ? Promise.resolve(undefined)
      : Promise.reject(err));
}

function testSupported(files, gameId) {
  const notSupported = () => Promise.resolve({ supported: false, requiredFiles: [], });
  const dfmods = files.filter(file => path.extname(file) === DFMOD_EXT);

  // No point proceeding if we find 0 dfmods.
  if (dfmods.length < 1)
    return notSupported();

  const supported = dfmods.length > 0 && gameId === GAME_ID
  
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function install(files, destinationPath) {
  const result = {
    instructions: [],
  };

  const dfmods = files.filter(file => path.extname(file) === DFMOD_EXT)
                      .map(mod => path.basename(mod));
  let filtered = files.filter(file => !file.endsWith(path.sep));

  filtered.forEach(file => {
    let pathLower = path.dirname(file).toLowerCase();

    const isWindows = pathLower.indexOf('windows') !== -1;
    const isLinux = pathLower.indexOf('linux') !== -1;
    const isOSX = pathLower.indexOf('osx') !== -1;

    // Only handle files that are either in a Windows folder or in no OS specific folder
    const doProcessForWindows = isWindows || (!isLinux && !isOSX);

    if (dfmods.indexOf(path.basename(file)) !== -1) {
      if (doProcessForWindows) {
        // This is the dfmod we want to install.
        result.instructions.push({
          type: 'copy',
          source: file,
          destination: path.join('Mods', path.basename(file)),
        });
      }
    } else {
      // Non-dfmod file, most likely other resources like texture overrides or quest packs etc.
      if (doProcessForWindows) {
        result.instructions.push({
          type: 'copy',
          source: file,
          destination: file,
        });
      }
    }
  });

  return Promise.resolve(result);
}

function main(context) {
	context.registerGame({
    id: GAME_ID,
    name: 'Daggerfall Unity',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: [],
    queryModPath: () => path.join('DaggerfallUnity_Data', 'StreamingAssets'),
    logo: 'gameart.jpg',
    getGameVersion: resolveGameVersion,
    executable: () => GAME_EXEC,
    requiredFiles: [
      GAME_EXEC,
    ],
  });

  // The game is multi-platform and many modders seem to be nesting the mod files
  //  inside the target platform, we're only interested in the windows version
  //  at this point
  context.registerInstaller('dfmodmultiplatform', 15, testSupported, install);

	return true
}

module.exports = {
  default: main,
};