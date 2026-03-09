const Promise = require('bluebird');
const path = require('path');
const winapi = require('winapi-bindings');
const { app, remote } = require('electron');
const { actions, fs, util } = require('vortex-api');

const uniApp = app || remote.app;

let _API;
const GAME_ID = 'dawnofman';
const STEAM_ID = 858810;
const GOG_ID = 1899257943;
const UMM_DLL = 'UnityModManager.dll';
const SCENE_FILE_EXT = '.scn.xml';
const UMM_MOD_INFO = 'Info.json';

function getSceneFolder() {
  return path.join(uniApp.getPath('documents'), 'DawnOfMan', 'Scenarios');
}

function readRegistryKey(hive, key, name) {
  try {
    const instPath = winapi.RegGetValue(hive, key, name);
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.reject(new util.ProcessCanceled(err));
  }
}

function findUnityModManager() {
  return readRegistryKey('HKEY_CURRENT_USER', 'Software\\UnityModManager', 'Path')
    .then(value => fs.statAsync(path.join(value, UMM_DLL)));
}

function findGame() {
  return util.steam.findByAppId(STEAM_ID.toString())
    .then(game => game.gamePath)
    .catch(() => readRegistryKey('HKEY_LOCAL_MACHINE',
      `SOFTWARE\\WOW6432Node\\GOG.com\\Games\\${GOG_ID}`,
      'PATH'))
    .catch(() => readRegistryKey('HKEY_LOCAL_MACHINE',
      `SOFTWARE\\GOG.com\\Games\\${GOG_ID}`,
      'PATH'))
}

function prepareForModding(discovery) {
  const showUMMDialog = () => new Promise((resolve, reject) => {
    _API.store.dispatch(actions.showDialog('question', 'Action required',
      {
        message: 'Most Dawn of Man mods require Unity Mod Manager to be installed to run correctly.\n'
               + 'Once installed, UMM must be used to inject your mods into the game itself.\n'
               + 'For ease of use, UMM comes pre-added as a tool for Dawn of Man but you may have\n'
               + 'to configure it manually.\n'
               + 'For usage information and download link please see UMM\'s page.\n\n'
               + 'Please note: simpler "Scenario" mods can be used without UMM.'
      },
      [
        { label: 'Continue', action: () => resolve() },
        { label: 'More on Vortex Tools', action: () => {
          util.opn('https://wiki.nexusmods.com/index.php/Category:Tool_Setup')
            .then(() => showUMMDialog())
            .catch(err => undefined);
          resolve();
        }},
        { label: 'Go to UMM page', action: () => {
          util.opn('https://www.nexusmods.com/site/mods/21/').catch(err => undefined);
          // We want to go forward even if UMM is not installed as the scenario modType
          //  can be installed without UMM.
          resolve();
        }},
      ]));
  });

  return fs.ensureDirWritableAsync(getSceneFolder(), () => Promise.resolve())
    .then(() => fs.ensureDirWritableAsync(path.join(discovery.path, 'Mods'), () => Promise.resolve()))
    .then(() => findUnityModManager()
      .catch(err => showUMMDialog()));
}

function endsWithPattern(instructions, pattern) {
  return Promise.resolve(instructions.find(inst =>
    ((!!inst?.destination) && inst.destination.endsWith(pattern))) !== undefined);
}

function installSceneMod(files, destinationPath) {
  const sceneFile = files.find(file => file.endsWith(SCENE_FILE_EXT));
  const idx = sceneFile.indexOf(path.basename(sceneFile));
  const modName = path.basename(destinationPath, '.installing')
    .replace(/[^A-Za-z]/g, '');

  const filtered = files.filter(file => !file.endsWith(path.sep))
  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(modName, file.substr(idx)),
    };
  })

  return Promise.resolve({ instructions });
}

function installMod(files, destinationPath) {
  // The scene file is expected to be at the root of scene mods.
  const infoFile = files.find(file => file.endsWith(UMM_MOD_INFO));
  const idx = infoFile.indexOf(UMM_MOD_INFO);
  const rootPath = path.dirname(infoFile);
  const modName = path.basename(destinationPath, '.installing')
    .replace(/[^A-Za-z]/g, '');

  const filtered = files.filter(file => (!file.endsWith(path.sep))
    && (file.indexOf(rootPath) !== -1));

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(modName, file.substr(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

function isSceneMod(files) {
  return files.find(file => file.endsWith(SCENE_FILE_EXT)) !== undefined;
}

function isUMMMod(files) {
  return files.find(file => file.endsWith(UMM_MOD_INFO)) !== undefined;
}

function testSceneMod(files, gameId) {
  return Promise.resolve({
    supported: ((gameId === GAME_ID) && (isSceneMod(files))),
    requiredFiles: []
  });
}

function testMod(files, gameId) {
  return Promise.resolve({
    supported: ((gameId === GAME_ID) && (isUMMMod(files))),
    requiredFiles: []
  });
}

function main(context) {
  _API = context.api;
  context.requireExtension('modtype-umm');
  context.registerGame({
    id: GAME_ID,
    name: 'Dawn of Man',
    logo: 'gameart.jpg',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'Mods',
    executable: () => 'DawnOfMan.exe',
    requiredFiles: [
      'DawnOfMan.exe'
    ],
    environment: {
      SteamAPPId: STEAM_ID.toString(),
    },
    details: {
      steamAppId: STEAM_ID,
      hashFiles: [
        'DawnOfMan_Data/Managed/Assembly-CSharp.dll',
      ],
    },
    setup: prepareForModding,
  });

  context.registerModType('dom-scene-modtype', 25,
    (gameId) => gameId === GAME_ID, () => getSceneFolder(),
    (instructions) => endsWithPattern(instructions, SCENE_FILE_EXT));

  context.registerInstaller('dom-scene-installer', 25, testSceneMod, installSceneMod);
  context.registerInstaller('dom-mod', 25, testMod, installMod);
}

module.exports = {
  default: main
};
