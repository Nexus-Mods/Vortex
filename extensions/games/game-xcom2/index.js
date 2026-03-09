const path = require('path');
const { fs, util, log } = require('vortex-api');
const { remote } = require('electron');

const XCOM2_ID = 'xcom2';
const WOTC_ID = 'xcom2-wotc';
const XCOM2_MODS = path.join('XComGame', 'Mods');
const XCOM2_CONFIG = path.join('XComGame', 'Config');
const WOTC_MODS = path.join('XCom2-WarOfTheChosen', 'XComGame', 'Mods');
const WOTC_CONFIG = path.join('XCom2-WarOfTheChosen', 'XComGame', 'Config');
const MOD_EXT = '.XComMod';
const MOD_OPTIONS = 'DefaultModOptions.ini';

const STEAMAPP_ID = '268500'; //WOTC is 593380 but it's the same folder so we don't need it.
const GOGAPP_ID = '1482002159'; //WOTC is 1414942413 but it's the same folder so we don't need it.
const EPICAPP_ID = '3be3c4d681bc46b3b8b26c5df3ae0a18';

// Dev tools
const X2DEVTOOLSSTEAMAPP_ID = '299990';
const WOTCDEVTOOLSSTEAMAPP_ID = '602410';

const optionsPath = (gameId) => {
  switch(gameId) {
    case(XCOM2_ID): return XCOM2_CONFIG;
    case(WOTC_ID): return WOTC_CONFIG;
    default: return '';
  }
}

const getModsPath = (gameId) => {
  switch(gameId) {
    case(XCOM2_ID): return XCOM2_MODS;
    case(WOTC_ID): return WOTC_MODS;
    default: return '';
  }
}

const instructions = (gameId) => {
  return `This page shows a list of all XCOM 2 mods you have installed with Vortex, Steam Workshop or manually.<br/><br/>`+
  `Use the checkboxes on this page to enable or disable the mods. Enabled mods will be added to ${MOD_OPTIONS} in the ${optionsPath(gameId)} folder and will be loaded by the game.`
}

/*
1.1 update based on the following information sources 
https://support.feralinteractive.com/docs/en/xcom2warofthechosen/1.3/steam/faqs/?access=FOJzacYvnB
https://www.gog.com/forum/xcom_2/actually_where_do_mods_go_in_this_version/page1
*/

function findGame() {
  return util.GameStoreHelper.findByAppId([STEAMAPP_ID, GOGAPP_ID, EPICAPP_ID])
      .then(game => game.gamePath);
}

function findDevTools(game) {
  const steamId = game === XCOM2_ID ? X2DEVTOOLSSTEAMAPP_ID : WOTCDEVTOOLSSTEAMAPP_ID;
  return util.GameStoreHelper.findByAppId([steamId])
      .then(game => game.gamePath);
}

function prepareForModding(discovery, modPath) {
  return fs.ensureDirAsync(path.join(discovery.path, modPath));
}

// The launcher is generic, but I want to show a different icon for WOTC :) 
function supportedTools(game) {
  return [
    {
      id: `${game}-launcher`,
      name: 'Launcher',
      logo: path.join('icons', game === XCOM2_ID ? 'xcom-icon.png' : 'wotc-icon.png'),
      executable: () => path.join('Launcher', 'launcher.exe'),
      requiredFiles: [
        path.join('Launcher', 'launcher.exe'),
      ],
      relative: true,
    },
    {
      id: `${game}-devtools`,
      name: 'ModBuddy',
      logo: path.join('icons', 'modbuddy.png'),
      queryPath: () => findDevTools(game),
      executable: () =>  path.join('Binaries', 'Win32', 'ModBuddy', 'XCOM ModBuddy.exe'),
      requiredFiles: [
        path.join('Binaries', 'Win32', 'ModBuddy', 'XCOM ModBuddy.exe')
      ]
    }
  ]
}

function main(context) {
  context.registerGame({
    id: XCOM2_ID,
    name: 'XCOM 2',
    logo: 'gameart-xcom2.jpg',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => XCOM2_MODS,
    executable: () => path.join('Binaries', 'Win64', 'XCom2.exe'),
    setup: (discovery) => prepareForModding(discovery, XCOM2_MODS),
    requiredFiles: [
      'XComGame',
      path.join('XComGame', 'CookedPCConsole', '3DUIBP.upk'),
      path.join('XComGame', 'CharacterPool', 'Importable', 'Demos&Replays.bin')
    ],
    supportedTools: supportedTools(XCOM2_ID),
    parameters: ['-fromLauncher', '-review', '-noRedScreens', '-noStartupMovies', '-CrashDumpWatcher'],
    environment: {
      SteamAPPId: STEAMAPP_ID,
    },
    details: {
      steamAppId: STEAMAPP_ID,
      gogAppId: GOGAPP_ID,
    },
  });

  context.registerGame({
    id: WOTC_ID,
    name: 'XCOM 2: War of the Chosen',
    logo: 'gameart-wotc.jpg',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => WOTC_MODS,
    executable: () => path.join('XCom2-WarOfTheChosen', 'Binaries', 'Win64', 'XCom2.exe'),
    setup: (discovery) => prepareForModding(discovery, WOTC_MODS),
    requiredFiles: [
      'XCom2-WarOfTheChosen',
      path.join('XCom2-WarOfTheChosen', 'XComGame', 'CookedPCConsole', '3DUIBP.upk')
    ],
    parameters: ['-fromLauncher', '-review', '-noRedScreens', '-noStartupMovies', '-CrashDumpWatcher'],
    environment: {
      SteamAPPId: STEAMAPP_ID,
    },
    supportedTools: supportedTools(WOTC_MODS),
    details: {
      steamAppId: STEAMAPP_ID,
      gogAppId: GOGAPP_ID,
      nexusPageId: 'xcom2',
      compatibleDownloads: ['xcom2']
    },
  });

  // Register an installer for XCOM mods to sanity check the file structure and add details to the mods themselves.
  context.registerInstaller('xcom2-installer', 25, testMod, installMod);
  
  // Register load order pages for both versions of the game.
  context.registerLoadOrder({
    gameId: XCOM2_ID,
    validate,
    deserializeLoadOrder: () => deserializeLoadOrder(context.api, XCOM2_ID),
    serializeLoadOrder: (loadOrder) => serializeLoadOrder(context.api, loadOrder, XCOM2_ID),
    toggleableEntries: true,
    usageInstructions: instructions(XCOM2_ID)
  });

  context.registerLoadOrder({
    gameId: WOTC_ID,
    validate,
    deserializeLoadOrder: () => deserializeLoadOrder(context.api, WOTC_ID),
    serializeLoadOrder: (loadOrder) => serializeLoadOrder(context.api, loadOrder, WOTC_ID),
    toggleableEntries: true,
    usageInstructions: instructions(WOTC_ID)
  });

  return true;
}

// Installing functions

function testMod(files, gameId) {
  const supported = (gameId === XCOM2_ID || gameId === WOTC_ID) 
    && (!!files.find(file => path.extname(file).toLowerCase() === MOD_EXT.toLowerCase()));

  return Promise.resolve({ supported, requiredFiles: [] });
}

async function installMod(files) {
  // Grab a list of any XComMod files.
  const xComModFiles = files.filter(file => path.extname(file).toLowerCase() == MOD_EXT.toLowerCase());

  // Prepare the XComMod attribute.
  const attributes = [{
    type: 'attribute',
    key: 'xComMods',
    value: xComModFiles.map(file => path.basename(file, MOD_EXT))
  }];

  // Sort the files as their respective mods (in the case of multiple mods in one archive)
  let copy = [];
  xComModFiles.forEach(mod => {
    // The name of the XComMod File, without the extension.
    const modName = path.basename(mod, MOD_EXT);
    // The containing folder (this should be the same.)
    const modFolder = path.dirname(mod);
    // Files in the mod folder
    const modFiles = files.filter(file => file.indexOf(modFolder) !== -1 && !file.endsWith(path.sep));
    // Instructions for Vortex from the file list.
    const modInstructions = modFiles.map(file => {
      // Trim off the folder name, in case it doesn't match the modName.
      const shortPath = modFolder != '.' ? file.substr(file.indexOf(modFolder) + modFolder.length) : file;
      return {
      type: 'copy',
      source: file,
      destination: path.join(modName, shortPath)
      }
    });
    // Add the instructions to the copy.
    copy = [...copy, ...modInstructions];
  });

  return Promise.resolve({ instructions: [...copy, ...attributes] });
}

// Load order functions

function validate(prev, cur) {
  const invalidNames = cur.filter(entry => entry.name.indexOf('"') != -1);
  const invalid = invalidNames.map(entry => ({ id: entry.id, reason: 'contains invalid characters.' }))
  if (invalidNames.length) return Promise.resolve({ invalid });
  return Promise.resolve();
}

async function deserializeLoadOrder(api, gameId) {
  // Get the path to the game.
  const state = api.store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
  if (!discovery?.path) return Promise.reject(new util.ProcessCanceled('The game could not be discovered.'));

  // Scan the mods folder for directories
  let folders = [];
  const modsPath = path.join(discovery.path, getModsPath(gameId));
  try {
    // Get everything in the mods folder located in the game directory. 
    const modFolders = await fs.readdirAsync(modsPath);
    // Iterate through the results of the folder scan.
    for (let idx in modFolders) {
      const entry = modFolders[idx];
      try {
        // Check we're looking at a folder.
        const folderStat = await fs.statAsync(path.join(modsPath, entry));
        if (!folderStat.isDirectory()) continue;
        // Check for the XComMod file named correctly.
        const statPath = path.join(modsPath, entry, `${entry}${MOD_EXT}`);
        await fs.statAsync(statPath);
        folders.push(entry);
      }
      catch (err) {
        if (err.code !== 'ENOENT') log('warn', 'Error checking for XComMod file in mod folder', err);
        continue;
      }
    }
  }
  catch(err) {
    log('error', `Error reading ${gameId} mods folder`, err);
  }

  // Get the latest deployment list.
  let deployedFiles = [];
  try {
    const manifest = await util.getManifest(api, '', gameId);
    deployedFiles = manifest.files;
  }
  catch(err) {
    if (err.code !== 'ENOENT') log('error', `Error reading manifest for ${gameId}`, err);
  }

  // If we have the game on Steam, also get the Steam Workshop mods.
  let workshopMods = [];
  if (discovery.path.toLowerCase().includes('steamapps')) {
    // Find the workshop content path
    const steamApps = discovery.path.substr(0, discovery.path.indexOf('common'));
    const workshopDir = path.join(steamApps, 'workshop', 'content', STEAMAPP_ID);
    try {
      const entries = await fs.readdirAsync(workshopDir);
      const folders = entries.filter(f => !path.extname(f));
      // Iterate through each resulting folder looking for XComMod files.
      workshopMods = await folders.reduce(async (prevP, cur) => {
        const prev = await prevP;
        const wsModPath = path.join(workshopDir, cur);
        const wsModDir = await fs.readdirAsync(wsModPath).catch(() => []);
        const modFile = wsModDir.find(file => path.extname(file).toLowerCase() === MOD_EXT.toLowerCase());
        if (modFile) prev.push(path.basename(modFile, MOD_EXT));
        return prev;
      }, Promise.resolve([]));
    }
    catch(err) {
      if (err.code !== 'ENOENT') log('warn', `Error reading workshop mods for ${gameId}`, err);
    }
  }

  // Now we need the INI which holds the enabled mods.
  const optionsIni = path.join(discovery.path, optionsPath(gameId), MOD_OPTIONS);
  let enabledMods = [];
  try {
    const file = await fs.readFileAsync(optionsIni, 'utf8');
    const arr = file.split('\n');
    const active = arr.filter(line => line.startsWith('ActiveMods=')).map(m => m.replace('ActiveMods=', ''));
    const names = active.map(mod => mod.replace(/"/g,''));
    // Only shown enabled mods that actually have a folder.
    enabledMods = names.filter(name => folders.includes(name) || workshopMods.includes(name));
  }
  catch(err) {
    if (err.code === 'ENOENT') log('info', `${MOD_OPTIONS} does not exist for ${gameId}`);
    else log('error', `Error reading ${MOD_OPTIONS} for ${gameId}`, err);
  }

  // Use a set to ensure there are no duplicates
  let loadOrderUniques = new Set([...enabledMods, ...folders, ...workshopMods]);

  // Map our data into a load order.
  const loadOrder = [...loadOrderUniques].map(xmod => {
    const steamMod = workshopMods.includes(xmod);
    const enabled = enabledMods.includes(xmod);
    const xmodPath = path.join(xmod, `${xmod}${MOD_EXT}`);
    const deployed = deployedFiles.find(file => file.relPath.toLowerCase() === xmodPath.toLowerCase());
    return {
      id: (steamMod === true) ? `steam-${xmod}.toLowerCase()`: xmod.toLowerCase(),
      name: xmod,
      enabled,
      modId: deployed ? deployed.source : undefined
    }
  });

  return Promise.resolve(loadOrder);

}

async function serializeLoadOrder(api, loadOrder, gameId) {
  // Get the game install folder.
  const state = api.store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
  if (!discovery?.path) return Promise.reject(new util.ProcessCanceled('The game could not be discovered.'));
  const optionsIni = path.join(discovery.path, optionsPath(gameId), MOD_OPTIONS);

  try {
    const mods = loadOrder.filter(entry => entry.enabled).map(entry => entry.name);
    return fs.writeFileAsync(optionsIni, xComModOptionsIni(mods), { encoding: 'utf-8' });
  }
  catch(err) {
    log('error', 'Error saving load order', err)
    return Promise.reject(err);
  }
}

const xComModOptionsIni = (mods) => {
  return `;Generated by Vortex ${remote.app.getVersion()} (https://www.nexusmods.com/about/vortex/)\n`+
  '[Engine.XComModOptions]\n'+
  mods.map(mod => `ActiveMods="${mod}"`).join('\n')+
  '\n\n;Use the below pattern to activate mods (no "+"/"-" etc. operators as this is the base INI file)\n'
  +';ActiveMods="TerrorFromTheDerp"\n'
  +';ActiveMods="Squadsize_EU"';
}

module.exports = {
  default: main,
};
