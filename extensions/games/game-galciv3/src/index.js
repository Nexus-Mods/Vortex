const Promise = require('bluebird');
const { app, remote } = require('electron');
const path = require('path');
const { fs, selectors, util } = require('vortex-api');
const winapi = require('winapi-bindings');

const appUni = app || remote.app;
const GAME_ID = 'galacticcivilizations3';

const STEAM_ID = 976210;
const GOG_ID = 1444400383;

const FACTION_EXT = '.faction';

function findGame() {
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      `SOFTWARE\\WOW6432Node\\GOG.com\\Games\\${GOG_ID.toString()}`,
      'path');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.steam.findByAppId(STEAM_ID.toString())
      .then(game => game.gamePath);
  }
}

function modPath() {
  return path.join(appUni.getPath('documents'), 'My Games', 'GalCiv3');
}

function crusadeModPath() {
  return path.join(appUni.getPath('documents'), 'My Games', 'GC3Crusade');
}

function dirExists(dirPath) {
  return fs.statAsync(dirPath)
    .then(() => Promise.resolve(true))
    .catch(() => Promise.resolve(false));
}

function installContent(files) {
  // We rely on mod authors to properly pack their mods and include.
  //  the mod folder within the archive
  //  e.g. someMod.7z
  //       ../someMod/Game/something.xml
  const filtered = files.filter(file => !file.endsWith(path.sep));
  const factionFiles = filtered.filter(file => file.endsWith(FACTION_EXT));
  const nonFactionFiles = filtered.filter(file => !file.endsWith(FACTION_EXT));
  const instructions = nonFactionFiles.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join('Mods', file),
    };
  }).concat(factionFiles.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join('Factions', file),
    };
  }));

  return Promise.resolve({ instructions });
}

function testSupportedContent(files, gameId) {
  // Make sure we're able to support this mod.
  const supported = (gameId === GAME_ID)
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Galactic Civilizations III',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => {
      const crusadePath = crusadeModPath();
      try {
        fs.statSync(crusadePath);
        return crusadePath;
      } catch (err) {
        return modPath();
      }
    },
    logo: 'gameart.jpg',
    executable: () => 'GalCiv3.exe',
    requiredFiles: [
      'GalCiv3.exe',
    ],
    environment: {
      SteamAPPId: STEAM_ID.toString(),
    },
    details: {
      steamAppId: STEAM_ID,
    },
  });

  context.registerInstaller('galciv3installer', 25, testSupportedContent, installContent);
  context.registerModType('galciv3crusade', 25, (gameId) => (gameId === GAME_ID),
    () => crusadeModPath(), () => dirExists(crusadeModPath()));

  context.once(() => {
    let displayNotification = false;
    context.api.onAsync('will-deploy', (profileId, deployment) => {
      const state = context.api.store.getState();
      const profile = selectors.profileById(state, profileId);
      if (GAME_ID !== profile?.gameId) {
        return Promise.resolve();
      }

      displayNotification = deployment[''].concat(deployment['galciv3crusade']).length === 0;
      return Promise.resolve();
    })
    context.api.onAsync('did-deploy', (profileId, deployment) => {
      if (!displayNotification) {
        return Promise.resolve();
      }

      const state = context.api.store.getState();
      const profile = selectors.profileById(state, profileId);

      if (GAME_ID !== profile?.gameId) {
        return Promise.resolve();
      }

      const newDepl = deployment[''].concat(deployment['galciv3crusade']);
      if (newDepl.length > 0) {
        context.api.sendNotification({
          type: 'info',
          id: 'galciv3-enable-mods',
          icon: 'attention-required',
          message: 'Please remember to enable mods in-game',
          displayMS: 5000,
        });
      }
      return Promise.resolve();
    });
  });

  return true;
}

module.exports = {
  default: main,
};
