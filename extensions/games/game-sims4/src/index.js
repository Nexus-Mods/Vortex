const Promise = require('bluebird');
const winapi = require('winapi-bindings');

const { remote, app } = require('electron');
const path = require('path');
const semver = require('semver');
const { actions, fs, log, util } = require('vortex-api');
const IniParser = require('vortex-parse-ini');

const appUni = app || remote.app;

// The Sims 4 mods folder may be affected by localization.
const LOCALE_MODS_FOLDER = {
  en_US: 'The Sims 4',
  de_DE: 'Die Sims 4',
  es_ES: 'Los Sims 4',
  // Yeah, the french even have more fancy directory names than everyone else...
  // \u00a0 is a unicode "no-break space"
  fr_FR: 'Les\u00a0Sims\u00a04',
  nl_NL: 'De Sims 4',
};

const MODS_SUB_PATH = 'Vortex Mods';
// attention: if this is changed, vortex will be unable to correctly filter
// the resource.cfg of previous versions
const PRIORITY = 1337;

function findGame() {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Currently only discovered on windows'));
  }
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\Maxis\\The Sims 4',
      'Install Dir');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.reject(err);
  }
}

let cachedModPath;

function getLocale(eaPath) {
  let locale;
  // check registry for the locale
  try {
    const candidate = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\Maxis\\The Sims 4',
      'Locale');
    if (!!candidate) {
      locale = candidate.value;
    }
  } catch (err) { }

  if ((locale !== undefined) && (LOCALE_MODS_FOLDER[locale] === undefined)) {
    locale = undefined;
  }

  // if we didn't find the locale in the registry (suspicious) loop through the known
  // ones and see if the corresponding mod folder exists
  if (locale === undefined) {
    locale = Object.keys(LOCALE_MODS_FOLDER).find(candidate => {
      try {
        const modsFolder = path.join(eaPath, LOCALE_MODS_FOLDER[candidate]);
        fs.statSync(modsFolder);
        return true;
      } catch (err) {
        return false;
      }
    });
  }

  if (locale === undefined) {
    // fall back to english directory name ("The Sims 4") because that's what
    // practically all variants use.
    log('warn', '[The Sims 4] Falling back to default mod directory because locale is unknown');
    locale = 'en_US';
  }

  return locale;
}

function findModPath() {
  const eaPath = path.join(appUni.getPath('documents'), 'Electronic Arts');

  const locale = getLocale(eaPath);
  return path.join(eaPath, LOCALE_MODS_FOLDER[locale], 'Mods');
}

function baseModPath() {
  if (cachedModPath === undefined) {
    cachedModPath = findModPath();
  }

  return cachedModPath;
}

function modPath() {
  return path.join(baseModPath(), MODS_SUB_PATH);
}

// a bit more generous than the default
const defaultResources = `Priority 500
PackedFile *.package
PackedFile */*.package
PackedFile */*/*.package
PackedFile */*/*/*.package
PackedFile */*/*/*/*.package
PackedFile */*/*/*/*/*.package`;

const resourceCfg = `Priority ${PRIORITY}
PackedFile ${MODS_SUB_PATH}/*.package
PackedFile ${MODS_SUB_PATH}/*/*.package
PackedFile ${MODS_SUB_PATH}/*/*/*.package
PackedFile ${MODS_SUB_PATH}/*/*/*/*.package
PackedFile ${MODS_SUB_PATH}/*/*/*/*/*.package
PackedFile ${MODS_SUB_PATH}/*/*/*/*/*/*.package`;


function filterResourceCfg(filePath) {
  return fs.readFileAsync(filePath, { encoding: 'utf8' })
    .then(data => {
      let res = [];
      let keep = true;
      let lastLineEmpty = false;
      data.split('\n')
        .forEach(line => {
          if (line === `Priority ${PRIORITY}`) {
            keep = false;
          } else if (line.startsWith('Priority')) {
            keep = true;
          }
          if (keep) {
            res.push(line);
          }
        });
      return res.filter(line => {
        if (line === '') {
          if (lastLineEmpty) {
            return false;
          } else {
            lastLineEmpty = true;
            return true;
          }
        } else {
          lastLineEmpty = false;
          return true;
        }
      })
        .join('\n');
    }).catch({ code: 'ENOENT' }, err => {
      return defaultResources;
    });
}

/**
 * This updates the resource cfg file to allow vortex to install mods into its own
 * directory, with directories up to 6 levels deep.
 * This should keep everything else intact unless the user really went out of their
 * way to make this difficult
 */
function writeResourceCfg(resourceBasePath) {
  const resourcePath = path.join(resourceBasePath, 'Resource.cfg');
  return filterResourceCfg(resourcePath)
    .then(filtered => {
      return fs.writeFileAsync(resourcePath, filtered + '\n\n' + resourceCfg);
    });
}

function enableModding() {
  const parser = new IniParser.default(new IniParser.WinapiFormat());
  const eaPath = path.join(util.getVortexPath('documents'), 'Electronic Arts');
  const locale = getLocale(eaPath);
  const filePath = path.join(eaPath, LOCALE_MODS_FOLDER[locale], 'Options.ini');

  return parser.read(filePath)
    .then(ini => {
      // we could create the section but I don't know how the game would react
      if (ini.data['options'] === undefined) { 
        return;
      }
      ini.data['options']['scriptmodsenabled'] = 1;
      ini.data['options']['modsdisabled'] = 0;
      return parser.write(filePath, ini);
    });
}

function prepareForModding() {
  return fs.ensureDirAsync(modPath())
    // The baseModPath _should_ be created by the game, but
    //  it appears that at least under certain scenarios it might be missing
    //  https://github.com/Nexus-Mods/Vortex/issues/6835
    .then(() => fs.ensureDirAsync(baseModPath()))
    .then(() => writeResourceCfg(baseModPath()))
    .then(() => enableModding());
}

const TRAY_EXTENSIONS = new Set([
  '.bpi', '.blueprint', '.trayitem', '.sfx', '.ion', '.householdbinary',
  '.sgi', '.hhi', '.room', '.midi', '.rmi',
]);

const MODS_EXTENSIONS = new Set([
  '.package', '.ts4script', '.py', '.pyc', '.pyo',
]);

function testMixed(files, gameId) {
  if (gameId !== 'thesims4') {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  const trayFile = files.find(
    file => {
      const ext = path.extname(file);
      return TRAY_EXTENSIONS.has(ext.toLowerCase());
     });

  return Promise.resolve({
    supported: trayFile !== undefined,
    requiredFiles: [],
  });
}

function hasParent(input, set) {
  if (input.length === 0) {
    return false;
  }

  const dirPath = path.dirname(input).toLowerCase();
  if (set.has(dirPath)) {
    return true;
  } else if (dirPath === '.') {
    return false;
  }
  return hasParent(dirPath, set);
}

function installMixed(files, destinationPath) {
  const instructions = [];

  instructions.push({ type: 'setmodtype', value: 'sims4mixed' });

  const ext = input => path.extname(input).toLowerCase();

  // find out which path(s) contain files for tray
  const traySamples = files.filter(filePath => TRAY_EXTENSIONS.has(ext(filePath)));
  let trayBases = new Set(traySamples
    .map(filePath => path.dirname(filePath).toLowerCase()));

  // find out which path(s) contain files for mods
  const modsSamples = files.filter(filePath => MODS_EXTENSIONS.has(ext(filePath)));
  let modsBases = new Set(modsSamples
    .map(filePath => path.dirname(filePath).toLowerCase()));

  // the following tries to account for overlap where the same directory contains files
  // for tray and mods:
  //   a) if a directory contains files with an extension for the mods directory,
  //      all files in that dir get copied to mods except for those that have an extension for
  //      tray directory
  //   b) if a directory contains files with an extension for the tray directory,
  //      all files in that dir get copied to tray, unless they were handled in a)
  //   c) everything that's left is also copied to mods, just in case
  //
  // This way, if a directory contains "tray files" but also a readme.txt, all files including
  // the readme go to tray.
  // If a directory contains "tray files", "mods files" and a readme.txt, tray files go to
  // tray, mods files go to mods and the readme also goes to mods.
  files.forEach(filePath => {
    if (filePath.endsWith(path.sep)) {
      return;
    }
    const instruction = {
      type: 'copy',
      source: filePath,
    };
    if (hasParent(filePath, modsBases) && !TRAY_EXTENSIONS.has(ext(filePath))) {
      instruction.destination = path.join('Mods', MODS_SUB_PATH, path.basename(filePath));
    } else if (hasParent(filePath, trayBases)) {
      instruction.destination = path.join('Tray', path.basename(filePath));
    } else {
      instruction.destination = path.join('Mods', MODS_SUB_PATH, path.basename(filePath));
    }
    instructions.push(instruction);
  });

  return Promise.resolve({ instructions });
}

function getMixedPath() {
  return path.resolve(baseModPath(), '..');
}

function migrate200(api, oldVersion) {
  if (semver.gte(oldVersion || '0.0.1', '2.0.1')) {
    return Promise.resolve();
  }

  const state = api.store.getState();
  const activatorId = util.getSafe(state, ['settings', 'mods', 'activator', 'thesims4'], undefined);
  const gameDiscovery =
    util.getSafe(state, ['settings', 'gameMode', 'discovered', 'thesims4'], undefined);

  if ((gameDiscovery === undefined)
      || (gameDiscovery.path === undefined)
      || (activatorId === undefined)) {
    // if this game is not discovered or deployed there is no need to migrate
    log('debug', 'skipping sims 4 migration because no deployment set up for it');
    return Promise.resolve();
  }

  let bmp;
  try {
    bmp = baseModPath();
  } catch (err) {
    // if there is no mod path, there is nothing to migrate anyway. Hopefully
    return Promise.resolve();
  }

  // would be good to inform the user beforehand but since this is run in the main process
  // and we can't currently show a (working) dialog from the main process it has to be
  // this way.
  return api.awaitUI()
    .then(() => fs.ensureDirWritableAsync(path.join(bmp, MODS_SUB_PATH)))
    .then(() => api.emitAndAwait('purge-mods-in-path', 'thesims4', '', path.join(bmp, MODS_SUB_PATH)))
    .then(() => api.emitAndAwait('purge-mods-in-path', 'thesims4', '', bmp))
    .then(() => {
      api.store.dispatch(actions.setDeploymentNecessary('thesims4', true));
    });
}

function main(context) {
  context.registerGame({
    id: 'thesims4',
    name: 'The Sims 4',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.jpg',
    executable: () => 'game/bin/TS4_x64.exe',
    setup: prepareForModding,
    supportedTools: [
      {
        id: 'exe32bit',
        name: 'The Sims 4 (32 bit)',
        logo: 'icon.png',
        executable: () => 'game/bin_le/TS4.exe',
        requiredFiles: [
          'game/bin/TS4.exe',
        ],
        relative: true,
      },
    ],
    requiredFiles: [
      'game/bin/TS4_x64.exe',
    ],
  });

  context.registerModType('sims4mixed', 25, gameId => gameId === 'thesims4', getMixedPath,
                          () => Promise.resolve(false));
  context.registerInstaller('sims4mixed', 25, testMixed, installMixed);
  context.registerMigration(old => migrate200(context.api, old));

  return true;
}

module.exports = {
  default: main
};
