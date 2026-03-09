const Promise = require('bluebird');
const { remote } = require('electron');
const path = require('path');
const winapi = require('winapi-bindings');
const { fs, util } = require('vortex-api');

const NWN_GAME_ID = 'nwn';
const NWNEE_GAME_ID = 'nwnee';

// Override folder name. We're going to assume that any files that are present
//  within an 'override' directory inside the archive, are going to be deployed 
//  to Neverwinter's override directory untampered.
const MOD_OVERRIDE = 'override';

// A map of file extensions mapped against their
//  expected folder name.
const MOD_EXT_DESTINATION = {
  '.mod': 'modules',
  '.tga': 'portraits',
  '.erf': 'erf',
  '.hak': 'hak',
  '.exe': 'hak',
  '.hif': 'hak',
  '.tlk': 'tlk',
  '.bmu': 'music',
  '.wav': 'ambient',
  '.cdx': 'database',
  '.dbf': 'database',
  '.fpt': 'database',
  '.nbm': 'movies',
  '.bik': 'movies',
  '.2da': 'override',
  '.uti': 'override',
  '.txi': 'override',
  '.mdl': 'override',
  '.ncs': 'override',
  '.dlg': 'override',
  '.utp': 'override',
};

// An array of moddable directories. We're going to
//  use this to identify whether a mod's archive structure
//  is already set-up and avoid using the per file extension custom installer.
const _MOD_DIRECTORIES = ['ambient', 'database', 'development',
  'dmvault', 'hak', 'localvault', 'logs', 'modules', 'movies', 'music',
  'nwsync', 'override', 'portraits', 'servervault', 'tempclient', 'tlk'];

function findGame() {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Currently only discovered on windows'));
  }
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\Wow6432Node\\Bioware\\NWN\\Neverwinter',
      'Location');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.reject(err);
  }
}

function findGameEE() {
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 704450',
      'InstallLocation');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.steam.findByName('Neverwinter Nights: Enhanced Edition')
      .then(game => game.gamePath);
  }
}


function modPath(context) {
  const state = context.api.store.getState();
  const discovery = state.settings.gameMode.discovered[NWN_GAME_ID];
  return discovery.path;
}

let _modsFolder;
function modPathEE() {
  if (_modsFolder === undefined) {
    _modsFolder = path.join(remote.app.getPath('documents'), 'Neverwinter Nights');
  }

  return _modsFolder;
}

function prepareForModding(discovery, context) {
  const raiseNotif = (candidates) => {
    context.api.sendNotification({
      id: 'nwn-ee-multi-modpaths',
      type: 'warning',
      title: 'Multiple mod paths detected',
      actions: [
        {
          title: 'More',
          action: () => {
            context.api.showDialog('warning', 'Multiple mod paths', {
              text: 'Vortex has detected multiple "viable" Neverwinter Nights mod paths on your system:\n\n'
                  + '{{modPaths}}\n\n'
                  + 'Please note that Vortex will only deploy mods to the following mod path:\n\n'
                  + '"{{modsPath}}"\n\n'
                  + 'We recommend you rename/remove the other mod paths to ensure the game uses '
                  + 'the same one that Vortex uses or your mods might not show correctly inside your game.',
              parameters: {
                modsPath: modPathEE(),
                modPaths: candidates.map(cand => `"${path.join(path.dirname(modPathEE()), cand)}"`).join('\n'),
              }
            },
            [
              { label: 'Go to Documents Folder', action: () => util.opn(path.dirname(modPathEE())).catch(() => null) },
              { label: 'Close' }
            ])
          }
        }
      ],
    });
    return Promise.resolve();
  }

  const rgx = /^Neverwinter Nights$|^Neverwinter Nights.[0-9]$/;
  const testModsPath = () => (context === undefined)
    ? Promise.resolve()
    : fs.readdirAsync(path.dirname(modPathEE())).then(entries => {
        const candidates = entries.filter(entry => rgx.test(entry));
        return (candidates.length > 1)
          ? raiseNotif(candidates)
          : Promise.resolve();
      });

  return Promise.map(Object.keys(MOD_EXT_DESTINATION),
    ext => fs.ensureDirAsync(path.join(context === undefined ? discovery.path : modPathEE(), MOD_EXT_DESTINATION[ext])))
    .then(() => testModsPath());
}

function main(context) {
  context.registerGame({
    id: NWN_GAME_ID,
    name: 'Neverwinter Nights',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => modPath(context),
    logo: 'gameart.jpg',
    executable: () => 'nwmain.exe',
    requiredFiles: [
      'nwmain.exe',
    ],
    details: {
      nexusPageId: 'neverwinter',
    },
    setup: prepareForModding,
  });

  context.registerGame({
    id: NWNEE_GAME_ID,
    name: 'Neverwinter Nights:\tEnhanced Edition',
    mergeMods: true,
    queryPath: findGameEE,
    queryModPath: modPathEE,
    logo: 'gameartee.png',
    executable: () => 'bin/win32/nwmain.exe',
    requiredFiles: [
      'bin/win32/nwmain.exe',
    ],
    environment: {
      SteamAPPId: '704450',
    },
    details: {
      nexusPageId: 'neverwinter',
      steamAppId: 704450,
    },
    setup: (discovery) => prepareForModding(discovery, context),
  });

  context.registerInstaller('nwn-mod', 25, testSupportedContent, installContent);

  return true;
}

/**
 * File extensions are used to dictate the destination for
 *  each file, unless the mod's files are placed within an
 *  override folder; in which case those files will be placed
 *  within the override game folder regardless of their ext.
 */
function installContent(files) {
  const instructions = files
    .filter(file => MOD_EXT_DESTINATION[path.extname(file).toLowerCase()] !== undefined)
    .map(file => {
      let finalDestination;
      if (file.indexOf(MOD_OVERRIDE) !== -1) {
        finalDestination = path.join(file);
      } else {
        const fileType = path.extname(file).toLowerCase();
        finalDestination = path.join(MOD_EXT_DESTINATION[fileType], path.basename(file));
      }

      return {
        type: 'copy',
        source: file,
        destination: finalDestination,
      };
    });

  return Promise.resolve({ instructions });
}

function testSupportedContent(files, gameId) {
  // Make sure we're able to support this mod.
  const supported = ([NWN_GAME_ID, NWNEE_GAME_ID].indexOf(gameId) !== -1)
    && (files.find(file => path.extname(file).toLowerCase() in MOD_EXT_DESTINATION) !== undefined)
    && !hasCorrectFolderStructure(files);
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function hasCorrectFolderStructure(files) {
  const matcher = (segment) => _MOD_DIRECTORIES.indexOf(segment) !== -1;
  const filtered = files.filter(file => {
    const segments = file.toLowerCase().split(path.sep).filter(seg => !!seg);
    return ((path.extname(segments[segments.length - 1]) === '')
      && (segments.find(matcher) !== undefined));
  });

  return filtered.length > 0;
}

module.exports = {
  default: main
};
