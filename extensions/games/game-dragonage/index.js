const { app, remote } = require('electron');
const path = require('path');
const { fs, util } = require('vortex-api');
const { Builder, parseStringPromise } = require('xml2js');
const winapi = require('winapi-bindings');

const appUni = app || remote.app;

const ADDINS_FILE = 'AddIns.xml';
const STEAM_ID = 17450;
const STEAM_ID_ULTIMATE_EDITION = 47810;

const VDF_EXT = '.vdf';

// Static variables to store paths we resolve using appUni.
let _ADDINS_PATH = undefined;
let _MODS_PATH = undefined;

let _APPID;
function findGame() {
  return util.GameStoreHelper.findByAppId([STEAM_ID.toString(), STEAM_ID_ULTIMATE_EDITION.toString()])
    .then(game => {
      _APPID = game.appid;
      return Promise.resolve(game.gamePath);
    })
    .catch(() => {
      try {
        const instPath = winapi.RegGetValue(
          'HKEY_LOCAL_MACHINE',
          'Software\\Wow6432Node\\BioWare\\Dragon Age',
          'Path');
        if (!instPath) {
          throw new Error('empty registry key');
        }
        return Promise.resolve(instPath.value);
      } catch (err) {
        return Promise.reject(err);
      }
    });
}

function queryModPath() {
  if (_MODS_PATH === undefined) {
    _MODS_PATH = path.join(appUni.getPath('documents'), 'BioWare', 'Dragon Age', 'packages', 'core', 'override');
  }

  return _MODS_PATH;
}

function addinsPath() {
  if (_ADDINS_PATH === undefined) {
    _ADDINS_PATH = path.join(appUni.getPath('documents'), 'Bioware', 'Dragon Age',
      'Settings', ADDINS_FILE);
  }

  return _ADDINS_PATH;
}

function prepareForModding() {
  return fs.ensureDirWritableAsync(queryModPath())
    .then(() => fs.ensureDirAsync(path.join(appUni.getPath('documents'), 'BioWare', 'Dragon Age', 'AddIns')))
    .then(() => fs.ensureDirAsync(path.dirname(addinsPath())));
}

const emptyAddins = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<AddInsList></AddInsList>`;

function test(game) {
  if (game.id !== 'dragonage') {
    return undefined;
  }

  return {
    baseFiles: () => [
      {
        in: addinsPath(),
        out: path.join('Settings', ADDINS_FILE),
      },
    ],
    filter: filePath => path.basename(filePath).toLowerCase() === 'manifest.xml',
  };
}

function requiresLauncher(gamePath) {
  // The presence of any .vdf files at the game's root suggests that this is
  //  a Steam copy (Both Game Editions)
  return fs.readdirAsync(gamePath)
    .then(entries => {
      const files = entries.filter(entry => path.extname(entry) !== '');
      return (files.find(file => path.extname(file) === VDF_EXT) !== undefined)
        ? Promise.resolve({ launcher: 'steam', addInfo: _APPID })
        : Promise.resolve(undefined);
    })
    .catch(() => Promise.resolve(undefined));
}

function readAddinsData(mergeDir) {
  return fs.readFileAsync(path.join(mergeDir, 'Settings', ADDINS_FILE))
    .catch(err => (err.code === 'ENOENT')
      ? fs.readFileAsync(addinsPath())
          .catch(fallbackErr => (fallbackErr.code === 'ENOENT')
              ? Promise.resolve(emptyAddins)
              : Promise.reject(fallbackErr))
      : Promise.reject(err)
    );
}

function merge(filePath, mergeDir) {
  let manifest;
  return fs.readFileAsync(filePath)
      .then(async xmlData => {
        try {
          manifest = await parseStringPromise(xmlData);
        } catch (err) {
          return Promise.reject(new util.ProcessCanceled(`File invalid "${filePath}"`));
        }
        return Promise.resolve();
      })
      .then(() => readAddinsData(mergeDir))
      .then(async addinsData => new Promise(async (resolve, reject) => {
        try {
          const data = await parseStringPromise(addinsData);
          return resolve(data);
        } catch (err) {
          return resolve(await parseStringPromise(emptyAddins));
        }
      }))
      .then(async addinsData => {
        const list = addinsData?.AddInsList?.AddInItem;
        const manifestList = manifest?.Manifest?.AddInsList !== undefined
          ? manifest.Manifest.AddInsList.reduce((accum, add) => {
            accum = accum.concat(...add?.AddInItem);
            return accum;
          }, [])
          : [];
        if (list === undefined) {
          return Promise.reject(new util.ProcessCanceled(`Addins file is invalid - "${path.join(mergeDir, 'Settings', ADDINS_FILE)}"`));
        }
        addinsData.AddInsList.AddInItem = [].concat([...list], [...manifestList]);
        const destPath = path.join(mergeDir, 'Settings');
        return fs.ensureDirWritableAsync(destPath)
          .then(async () => {
            const builder = new Builder();
            const xml = builder.buildObject(addinsData);
            return fs.writeFileAsync(path.join(destPath, ADDINS_FILE), xml, { encoding: 'utf-8' })
          });
      });
}

function main(context) {
  context.requireExtension('modtype-dragonage');
  context.registerGame({
    id: 'dragonage',
    name: 'Dragon Age: Origins',
    mergeMods: true,
    requiresLauncher,
    queryPath: findGame,
    queryModPath,
    logo: 'gameart.jpg',
    executable: () => 'bin_ship/daorigins.exe',
    setup: prepareForModding,
    requiredFiles: [
      'bin_ship/daorigins.exe',
    ],
    environment: {
      SteamAPPId: STEAM_ID.toString(),
    },
    details: {
      steamAppId: STEAM_ID,
    },
  });
  context.registerMerge(test, merge, 'dazip');

  return true;
}

module.exports = {
  default: main,
};
