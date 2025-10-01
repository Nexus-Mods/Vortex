/*///////////////////////////////////////
Name: Balatro Vortex Extension
Structure: Mod Loader (AppData Folder)
Author: ChemBoy1
Version: 0.1.2
Date: 2025-05-28
///////////////////////////////////////*/

//Import libraries
const { actions, fs, util, selectors, log } = require('vortex-api');
const path = require('path');
const template = require('string-template');
const { download, findModByFile, findDownloadIdByFile, resolveVersionByPattern, testRequirementVersion } = require('./downloader');
const semver = require('semver');

//Specify all the information about the game
const GAME_ID = "balatro";
const GAME_NAME = "Balatro";
const GAME_NAME_SHORT = "Balatro";
const STEAMAPP_ID = "2379780";
const XBOXAPP_ID = "PlayStack.Balatro";
const XBOXEXECNAME = "Balatro";

const EXEC_STEAM = `Balatro.exe`;
const EXEC_XBOX = `gamelaunchhelper.exe`;
let GAME_VERSION = '';

//Info for mod types and installers
const APPDATA = util.getVortexPath("appData");
const MOD_ID = `${GAME_ID}-mod`;
const MOD_NAME = "Mod";
const MOD_PATH = path.join(APPDATA, "Balatro", "Mods");

const ROOT_ID = `${GAME_ID}-root`;
const ROOT_NAME = "Root Folder";

const LOVELY_ID = `${GAME_ID}-LOVELY`;
const LOVELY_NAME = "Lovely-Injector";
const LOVELY_FILE = "version.dll"; // <-- CASE SENSITIVE! Must match name exactly or downloader will download the file again.
const LOVELY_URL = 'https://github.com/ethangreen-dev/lovely-injector/releases/download/v0.7.1/lovely-x86_64-pc-windows-msvc.zip';
const LOVELY_URL_LATEST = 'https://github.com/ethangreen-dev/lovely-injector/releases/latest/download/lovely-x86_64-pc-windows-msvc.zip';
const LOVELY_URL_MANUAL = 'https://github.com/ethangreen-dev/lovely-injector/releases';

// Information for Lovely Injector downloader and updater
const LOVELY_ARC_NAME = 'lovely-x86_64-pc-windows-msvc.zip';
const AUTHOR = 'ethangreen-dev';
const REPO = 'lovely-injector';
const LOVELY_URL_MAIN = `https://api.github.com/repos/${AUTHOR}/${REPO}`;
const REQUIREMENTS = [
  { //lovely injector
    archiveFileName: LOVELY_ARC_NAME,
    modType: LOVELY_ID,
    assemblyFileName: LOVELY_FILE,
    userFacingName: LOVELY_NAME,
    githubUrl: LOVELY_URL_MAIN,
    findMod: (api) => findModByFile(api, LOVELY_ID, LOVELY_FILE),
    findDownloadId: (api) => findDownloadIdByFile(api, LOVELY_ARC_NAME),
    fileArchivePattern: new RegExp(/^lovely-x86_64-pc-windows-msvc/, 'i'),
    resolveVersion: (api) => resolveVersionByPattern(api, REQUIREMENTS[0]),
  },
];

//* Function to resolve version by a means other than the archive name
async function resolveVersionByFile(api, requirement) {
  const state = api.getState();
  const files = util.getSafe(state, ['persistent', 'downloads', 'files'], []);
  const latestVersion = Object.values(files).reduce((prev, file) => {
    const match = requirement.fileArchivePattern.exec(file.localPath);
    if ((match === null || match === void 0 ? void 0 : match[1]) && semver.gt(match[1], prev)) {
        prev = match[1];
    }
    return prev;
  }, '0.0.0');
  return latestVersion;
} //*/

const STEAMMODDED_ID = `${GAME_ID}-steammodded`;
const STEAMMODDED_NAME = "SteamModded";
const STEAMMODDED_PATH = MOD_PATH;
const STEAMMODDED_FILE = "tk_debug_window.py";
const STEAMMODDED_PAGE_NO = 45;
const STEAMMODDED_FILE_NO = 878;

const REQ_FILE = EXEC_STEAM;
//const REQ_FILE = `love.dll`;

//Filled in from info above
const spec = {
  "game": {
    "id": GAME_ID,
    "name": GAME_NAME,
    "shortName": GAME_NAME_SHORT,
    "executable": EXEC_STEAM,
    "logo": `${GAME_ID}.jpg`,
    "mergeMods": true,
    "requiresCleanup": true,
    "modPath": MOD_PATH,
    "modPathIsRelative": false,
    "requiredFiles": [
      REQ_FILE,
    ],
    "details": {
      "steamAppId": +STEAMAPP_ID,
      "xboxAppId": XBOXAPP_ID,
    },
    "environment": {
      "SteamAPPId": STEAMAPP_ID,
      "XboxAPPId": XBOXAPP_ID
    }
  },
  "modTypes": [
    {
      "id": MOD_ID,
      "name": MOD_NAME,
      "priority": "high",
      "targetPath": MOD_PATH
    },
    {
      "id": ROOT_ID,
      "name": ROOT_NAME,
      "priority": "high",
      "targetPath": `{gamePath}`
    },
    {
      "id": LOVELY_ID,
      "name": LOVELY_NAME,
      "priority": "low",
      "targetPath": `{gamePath}`
    },
    {
      "id": STEAMMODDED_ID,
      "name": STEAMMODDED_NAME,
      "priority": "low",
      "targetPath": STEAMMODDED_PATH
    },
  ],
  "discovery": {
    "ids": [
      STEAMAPP_ID,
      //XBOXAPP_ID,
    ],
    "names": []
  }
};

//3rd party tools and launchers
const tools = [
  
];

//Set mod type priorities
function modTypePriority(priority) {
  return {
    high: 25,
    low: 75,
  }[priority];
}

//Replace folder path string placeholders with actual folder paths
function pathPattern(api, game, pattern) {
  var _a;
  return template(pattern, {
    gamePath: (_a = api.getState().settings.gameMode.discovered[game.id]) === null || _a === void 0 ? void 0 : _a.path,
    documents: util.getVortexPath('documents'),
    localAppData: util.getVortexPath('localAppData'),
    appData: util.getVortexPath('appData'),
  });
}

//Set the mod path for the game
function makeGetModPath(api, gameSpec) {
  return () => gameSpec.game.modPathIsRelative !== false
    ? gameSpec.game.modPath || '.'
    : pathPattern(api, gameSpec.game, gameSpec.game.modPath);
}

//Find game installation directory
function makeFindGame(api, gameSpec) {
  return () => util.GameStoreHelper.findByAppId(gameSpec.discovery.ids)
    .then((game) => game.gamePath);
}

async function requiresLauncher(gamePath, store) {
  if (store === 'xbox') {
    return Promise.resolve({
      launcher: 'xbox',
      addInfo: {
        appId: XBOXAPP_ID,
        parameters: [{ appExecName: XBOXEXECNAME }],
      },
    });
  } //*/
  if (store === 'steam') {
    return Promise.resolve({
      launcher: 'steam',
    });
  } //*/
  return Promise.resolve(undefined);
}

//Get correct executable, add to required files, set paths for mod types
function getExecutable(discoveryPath) {
  const isCorrectExec = (exec) => {
    try {
      fs.statSync(path.join(discoveryPath, exec));
      return true;
    }
    catch (err) {
      return false;
    }
  };
  if (isCorrectExec(EXEC_XBOX)) {
    GAME_VERSION = 'xbox';
    return EXEC_XBOX;
  };
  if (isCorrectExec(EXEC_STEAM)) {
    GAME_VERSION = 'steam';
    return EXEC_STEAM;
  };
  return EXEC_STEAM;
}

// MOD INSTALLER FUNCTIONS ///////////////////////////////////////////////////

//Installer test for LOVELY files
function testLOVELY(files, gameId) {
  const isMod = files.some(file => (path.basename(file).toLowerCase() === LOVELY_FILE));
  let supported = (gameId === spec.game.id) && isMod;

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

//Installer install LOVELY files
function installLOVELY(files) {
  const modFile = files.find(file => (path.basename(file).toLowerCase() === LOVELY_FILE));
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);
  const setModTypeInstruction = { type: 'setmodtype', value: LOVELY_ID };

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(file =>
    ((file.indexOf(rootPath) !== -1) && (!file.endsWith(path.sep)))
  );

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file.substr(idx)),
    };
  });
  instructions.push(setModTypeInstruction);

  return Promise.resolve({ instructions });
}

//Installer test for SteamModded files
function testSteamModded(files, gameId) {
  const isMod = files.some(file => (path.basename(file).toLowerCase() === STEAMMODDED_FILE));
  let supported = (gameId === spec.game.id) && isMod;

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

//Installer install SteamModded files
function installSteamModded(files) {
  const modFile = files.find(file => (path.basename(file).toLowerCase() === STEAMMODDED_FILE));
  const setModTypeInstruction = { type: 'setmodtype', value: STEAMMODDED_ID };

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(file =>
    (!file.endsWith(path.sep))
  );

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file),
    };
  });
  instructions.push(setModTypeInstruction);

  return Promise.resolve({ instructions });
}

// AUTOMATIC DOWNLOAD FUNCTIONS /////////////////////////////////////////////////

async function onCheckModVersion(api, gameId, mods, forced) {
  try {
    await testRequirementVersion(api, REQUIREMENTS[0]);
  } catch (err) {
    log('warn', 'failed to test requirement version', err);
  }
}

async function checkForLOVELY(api) {
  const mod = await REQUIREMENTS[0].findMod(api);
  return mod !== undefined;
}

//Check if SteamModded is installed
function isSteamModdedInstalled(api, spec) {
  const state = api.getState();
  const mods = state.persistent.mods[spec.game.id] || {};
  return Object.keys(mods).some(id => mods[id]?.type === STEAMMODDED_ID);
}

//Check if SteamModded is installed
function isLOVELYInstalled(api, spec) {
  const state = api.getState();
  const mods = state.persistent.mods[spec.game.id] || {};
  return Object.keys(mods).some(id => mods[id]?.type === LOVELY_ID);
}


//* Function to auto-download SteamModded from Nexus Mods
async function downloadSteamModded(api, gameSpec) {
  let isInstalled = isSteamModdedInstalled(api, gameSpec);
  if (!isInstalled) {
    const MOD_NAME = STEAMMODDED_NAME;
    const MOD_TYPE = STEAMMODDED_ID;
    const NOTIF_ID = `${GAME_ID}-${MOD_TYPE}-installing`;
    const PAGE_ID = STEAMMODDED_PAGE_NO;
    const FILE_ID = STEAMMODDED_FILE_NO;  //If using a specific file id because "input" below gives an error
    const GAME_DOMAIN = gameSpec.game.id;
    api.sendNotification({ //notification indicating install process
      id: NOTIF_ID,
      message: `Installing ${MOD_NAME}`,
      type: 'activity',
      noDismiss: true,
      allowSuppress: false,
    });
    if (api.ext?.ensureLoggedIn !== undefined) { //make sure user is logged into Nexus Mods account in Vortex
      await api.ext.ensureLoggedIn();
    }
    try {
      let FILE = null;
      let URL = null;
      try { //get the mod files information from Nexus
        const modFiles = await api.ext.nexusGetModFiles(GAME_DOMAIN, PAGE_ID);
        const fileTime = () => Number.parseInt(input.uploaded_time, 10);
        const file = modFiles
          .filter(file => file.category_id === 1)
          .sort((lhs, rhs) => fileTime(lhs) - fileTime(rhs))[0];
        if (file === undefined) {
          throw new util.ProcessCanceled(`No ${MOD_NAME} main file found`);
        }
        FILE = file.file_id;
        URL = `nxm://${GAME_DOMAIN}/mods/${PAGE_ID}/files/${FILE}`;
      } catch (err) { // use defined file ID if input is undefined above
        FILE = FILE_ID;
        URL = `nxm://${GAME_DOMAIN}/mods/${PAGE_ID}/files/${FILE}`;
      }
      const dlInfo = { //Download the mod
        game: gameSpec.game.id,
        name: MOD_NAME,
      };
      const dlId = await util.toPromise(cb =>
        api.events.emit('start-download', [URL], dlInfo, undefined, cb, undefined, { allowInstall: false }));
      const modId = await util.toPromise(cb =>
        api.events.emit('start-install-download', dlId, { allowAutoEnable: false }, cb));
      const profileId = selectors.lastActiveProfileForGame(api.getState(), gameSpec.game.id);
      const batched = [
        actions.setModsEnabled(api, profileId, [modId], true, {
          allowAutoDeploy: true,
          installed: true,
        }),
        actions.setModType(gameSpec.game.id, modId, MOD_TYPE), // Set the mod type
      ];
      util.batchDispatch(api.store, batched); // Will dispatch both actions
    } catch (err) { //Show the user the download page if the download, install process fails
      const errPage = `https://www.nexusmods.com/${GAME_DOMAIN}/mods/${PAGE_ID}/files/?tab=files`;
      api.showErrorNotification(`Failed to download/install ${MOD_NAME}`, err);
      util.opn(errPage).catch(() => null);
    } finally {
      api.dismissNotification(NOTIF_ID);
    }
  }
} //*/

//* Function to auto-download Lovely Injector from GitHub
async function downloadLOVELY(api, gameSpec) {
  let isInstalled = isLOVELYInstalled(api, gameSpec);
  if (!isInstalled) {
    const MOD_NAME = LOVELY_NAME;
    const MOD_TYPE = LOVELY_ID;
    const NOTIF_ID = `${GAME_ID}-${MOD_TYPE}-installing`;
    const GAME_DOMAIN = gameSpec.game.id;
    api.sendNotification({ //notification indicating install process
      id: NOTIF_ID,
      message: `Installing ${MOD_NAME}`,
      type: 'activity',
      noDismiss: true,
      allowSuppress: false,
    });
    if (api.ext?.ensureLoggedIn !== undefined) { //make sure user is logged into Nexus Mods account in Vortex
      await api.ext.ensureLoggedIn();
    }
    try {
      const URL = LOVELY_URL_LATEST;
      const dlInfo = { //Download the mod
        game: gameSpec.game.id,
        name: MOD_NAME,
      };
      const dlId = await util.toPromise(cb =>
        api.events.emit('start-download', [URL], dlInfo, undefined, cb, undefined, { allowInstall: false }));
      const modId = await util.toPromise(cb =>
        api.events.emit('start-install-download', dlId, { allowAutoEnable: false }, cb));
      const profileId = selectors.lastActiveProfileForGame(api.getState(), gameSpec.game.id);
      const batched = [
        actions.setModsEnabled(api, profileId, [modId], true, {
          allowAutoDeploy: true,
          installed: true,
        }),
        actions.setModType(gameSpec.game.id, modId, MOD_TYPE), // Set the mod type
      ];
      util.batchDispatch(api.store, batched); // Will dispatch both actions
    } catch (err) { //Show the user the download page if the download, install process fails
      const errPage = LOVELY_URL_MANUAL;
      api.showErrorNotification(`Failed to download/install ${MOD_NAME}`, err);
      util.opn(errPage).catch(() => null);
    } finally {
      api.dismissNotification(NOTIF_ID);
    }
  }
} //*/

//* Function to auto-download Lovely Injector from GitHub (no check, for button)
async function downloadLOVELYNoCheck(api, gameSpec) {
  const MOD_NAME = LOVELY_NAME;
  const MOD_TYPE = LOVELY_ID;
  const NOTIF_ID = `${GAME_ID}-${MOD_TYPE}-installing`;
  const GAME_DOMAIN = gameSpec.game.id;
  api.sendNotification({ //notification indicating install process
    id: NOTIF_ID,
    message: `Installing ${MOD_NAME}`,
    type: 'activity',
    noDismiss: true,
    allowSuppress: false,
  });
  if (api.ext?.ensureLoggedIn !== undefined) { //make sure user is logged into Nexus Mods account in Vortex
    await api.ext.ensureLoggedIn();
  }
  try {
    const URL = LOVELY_URL_LATEST;
    const dlInfo = { //Download the mod
      game: gameSpec.game.id,
      name: MOD_NAME,
    };
    const dlId = await util.toPromise(cb =>
      api.events.emit('start-download', [URL], dlInfo, undefined, cb, undefined, { allowInstall: false }));
    const modId = await util.toPromise(cb =>
      api.events.emit('start-install-download', dlId, { allowAutoEnable: false }, cb));
    const profileId = selectors.lastActiveProfileForGame(api.getState(), gameSpec.game.id);
    const batched = [
      actions.setModsEnabled(api, profileId, [modId], true, {
        allowAutoDeploy: true,
        installed: true,
      }),
      actions.setModType(gameSpec.game.id, modId, MOD_TYPE), // Set the mod type
    ];
    util.batchDispatch(api.store, batched); // Will dispatch both actions
  } catch (err) { //Show the user the download page if the download, install process fails
    const errPage = LOVELY_URL_MANUAL;
    api.showErrorNotification(`Failed to download/install ${MOD_NAME}`, err);
    util.opn(errPage).catch(() => null);
  } finally {
    api.dismissNotification(NOTIF_ID);
  }
} //*/

//* Download Lovely Injector from GitHub page (user browse for download)
async function downloadLOVELYManual(api, gameSpec) {
  let isInstalled = isLOVELYInstalled(api, gameSpec);
  const URL = LOVELY_URL_MANUAL;
  const MOD_NAME = LOVELY_NAME;
  const MOD_TYPE = LOVELY_ID;
  const ARCHIVE_NAME = LOVELY_ARC_NAME;
  const instructions = api.translate(`Click on Continue below to open the browser. - `
    + `Navigate to the latest version of ${MOD_NAME} on the GitHub releases page and `
    + `click on the appropriate file to download and install the mod.`
  );

  if (!isInstalled) {
    return new Promise((resolve, reject) => { //Browse to modDB and download the mod
      return api.emitAndAwait('browse-for-download', URL, instructions)
      .then((result) => { //result is an array with the URL to the downloaded file as the only element
        if (!result || !result.length) { //user clicks outside the window without downloading
          return reject(new util.UserCanceled());
        }
        if (!result[0].toLowerCase().includes(ARCHIVE_NAME)) { //if user downloads the wrong file
          return reject(new util.ProcessCanceled('Selected wrong download'));
        } //*/
        return Promise.resolve(result);
      })
      .catch((error) => {
        return reject(error);
      })
      .then((result) => {
        const dlInfo = {game: gameSpec.game.id, name: MOD_NAME};
        api.events.emit('start-download', result, {}, undefined,
          async (error, id) => { //callback function to check for errors and pass id to and call 'start-install-download' event
            if (error !== null && (error.name !== 'AlreadyDownloaded')) {
              return reject(error);
            }
            api.events.emit('start-install-download', id, { allowAutoEnable: true }, async (error) => { //callback function to complete the installation
              if (error !== null) {
                return reject(error);
              }
              const profileId = selectors.lastActiveProfileForGame(api.getState(), GAME_ID);
              const batched = [
                actions.setModsEnabled(api, profileId, result, true, {
                  allowAutoDeploy: true,
                  installed: true,
                }),
                actions.setModType(GAME_ID, result[0], MOD_TYPE), // Set the mod type
              ];
              util.batchDispatch(api.store, batched); // Will dispatch both actions.
              return resolve();
            });
          }, 
          'never',
          { allowInstall: false },
        );
      });
    })
    .catch(err => {
      if (err instanceof util.UserCanceled) {
        api.showErrorNotification(`User cancelled download/install of ${MOD_NAME}. Please re-launch Vortex and try again.`, err, { allowReport: false });
        //util.opn(URL).catch(() => null);
        return Promise.resolve();
      } else if (err instanceof util.ProcessCanceled) {
        api.showErrorNotification(`Failed to download/install ${MOD_NAME}. Please re-launch Vortex and try again or download manually from modDB at the opened paged and install the zip in Vortex.`, err, { allowReport: false });
        util.opn(URL).catch(() => null);
        return Promise.reject(err);
      } else {
        return Promise.reject(err);
      }
    });
  }
} //*/

// MAIN FUNCTIONS ///////////////////////////////////////////////////////////////

//Setup function
async function setup(discovery, api, gameSpec) {
  await fs.ensureDirWritableAsync(MOD_PATH);
  await downloadSteamModded(api, gameSpec);
  return downloadLOVELY(api, gameSpec);
  //const LOVELYInstalled = await checkForLOVELY(api);
  //return LOVELYInstalled ? Promise.resolve() : download(api, REQUIREMENTS);
}

//Let Vortex know about the game
function applyGame(context, gameSpec) {
  //register game
  const game = {
    ...gameSpec.game,
    queryPath: makeFindGame(context.api, gameSpec),
    queryModPath: makeGetModPath(context.api, gameSpec),
    requiresLauncher: requiresLauncher,
    setup: async (discovery) => await setup(discovery, context.api, gameSpec),
    executable: () => gameSpec.game.executable,
    supportedTools: tools,
  };
  context.registerGame(game);

  //register mod types
  (gameSpec.modTypes || []).forEach((type, idx) => {
    context.registerModType(type.id, modTypePriority(type.priority) + idx, (gameId) => {
      var _a;
      return (gameId === gameSpec.game.id)
        && !!((_a = context.api.getState().settings.gameMode.discovered[gameId]) === null || _a === void 0 ? void 0 : _a.path);
    }, (game) => pathPattern(context.api, game, type.targetPath), () => Promise.resolve(false), { name: type.name });
  });

  //register mod installers
  context.registerInstaller(LOVELY_ID, 25, testLOVELY, installLOVELY);
  context.registerInstaller(STEAMMODDED_ID, 27, testSteamModded, installSteamModded);
  //context.registerInstaller(MOD_ID, 29, testMod, installMod);

  //register actions
  context.registerAction('mod-icons', 300, 'open-ext', {}, 'Download Lovely-Injector', () => {
    downloadLOVELYNoCheck(context.api, gameSpec).catch(() => null);
  }, () => {
    const state = context.api.getState();
    const gameId = selectors.activeGameId(state);
    return gameId === GAME_ID;
  }); //*/
}

//main function
function main(context) {
  applyGame(context, spec);
  context.once(() => { // put code here that should be run (once) when Vortex starts up
    /*context.api.onAsync('check-mods-version', (profileId, gameId, mods, forced) => {
      const LAST_ACTIVE_PROFILE = selectors.lastActiveProfileForGame(context.api.getState(), GAME_ID);
      if (profileId !== LAST_ACTIVE_PROFILE) return;
      return onCheckModVersion(context.api, gameId, mods, forced)
    }); //*/
  });
  return true;
}

//export to Vortex
module.exports = {
  default: main,
};
