/* eslint-disable */
const { getFileVersion, getFileVersionLocalized } = require('exe-version');
const path = require('path');
const { actions, selectors, util } = require('vortex-api');
const winapi = require('winapi-bindings');

const GAME_ID = 'skyrimvr';
const ESL_ENABLER_LIB = 'skyrimvresl.dll';
const ESL_NOTIF_ID = 'skyvr-esl-enabler-notif';

function findGame() {
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\Wow6432Node\\Bethesda Softworks\\Skyrim VR',
      'Installed Path');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return util.GameStoreHelper.findByAppId(['611670'])
      .then(game => game.gamePath);
  }
}

function getGameVersion(gamePath, exePath) {
  const fullPath = path.join(gamePath, exePath);
  const fileVersion = getFileVersion(fullPath);

  return (Promise.resolve((fileVersion !== '1.0.0.0')
    ? fileVersion
    : getFileVersionLocalized(fullPath)))
    .then(version => version + '-VR');
}

const tools = [
  {
    id: 'TES5VREdit',
    name: 'TES5VREdit',
    logo: 'tes5edit.png',
    executable: () => 'TES5VREdit.exe',
    requiredFiles: [
      'TES5VREdit.exe',
    ],
  },
  {
    id: 'FNIS',
    name: 'Fores New Idles in Skyrim',
    shortName: 'FNIS',
    logo: 'fnis.png',
    executable: () => 'GenerateFNISForUsers.exe',
    requiredFiles: [
      'GenerateFNISForUsers.exe',
    ],
    relative: true,
  },
  {
    id: 'sksevr',
    name: 'Skyrim Script Extender VR',
    shortName: 'SKSEVR',
    executable: () => 'sksevr_loader.exe',
    requiredFiles: [
      'sksevr_loader.exe',
      'SkyrimVR.exe',
    ],
    relative: true,
    exclusive: true,
    defaultPrimary: true,
  },
];

function isESLSupported(api) {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (discovery?.store === 'xbox') {
    return false;
  }
  const modState = util.getSafe(state, ['persistent', 'profiles', profileId, 'modState'], {});
  const isEnabled = (modId) => util.getSafe(modState, [modId, 'enabled'], false);
  const mods = util.getSafe (state, ['persistent', 'mods', GAME_ID], {});
  const hasESLEnabler = Object.keys(mods).some(modId => isEnabled(modId) && mods[modId]?.attributes?.eslEnabler === true);
  if (hasESLEnabler) {
    api.dismissNotification(ESL_NOTIF_ID);
  }
  return hasESLEnabler;
}

function testEslEnabler(files, gameId) {
  const isSkyrimVR = gameId === GAME_ID;
  const isESLEnabler = files.some(file => file.toLowerCase().endsWith(ESL_ENABLER_LIB));
  return Promise.resolve({
    supported: isSkyrimVR && isESLEnabler,
    requiredFiles: [],
  });
}

function installEslEnabler(files, destinationPath) {
  const filtered = files.filter(file => path.extname(file) !== '');
  const instructions = filtered.map(file => {
    const segments = file.split(path.sep);
    segments.splice(0, 1, 'Data');
    return {
      type: 'copy',
      source: file,
      destination: segments.join(path.sep),
    };
  });

  // Remove this once the mod type conflict issue is resolved
  instructions.push({ type: 'setmodtype', value: 'dinput' });
  instructions.push({ type: 'attribute', key: 'eslEnabler', value: true });

  return Promise.resolve({ instructions });
}

function prepare(api, discovery) {
  if (isESLSupported(api)) {
    return Promise.resolve();
  }

  api.sendNotification({
    id: ESL_NOTIF_ID,
    type: 'info',
    title: 'ESL Support',
    message: 'Skyrim VR requires a mod to enable ESL support. Mod must be installed through Vortex for ESL support to work.',
    actions: [
      {
        title: 'Download',
        action: () => util.opn('https://www.nexusmods.com/skyrimspecialedition/mods/106712?tab=files').catch(() => {}),
      },
    ],
  });
}

const sortAndResolve = (api) => {
  api.events.emit('autosort-plugins', false);
  return Promise.resolve();
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Skyrim VR',
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'Data',
    logo: 'gameart.jpg',
    executable: () => 'SkyrimVR.exe',
    getGameVersion,
    setup: (discovery) => prepare(context.api, discovery),
    requiredFiles: [
      'SkyrimVR.exe',
    ],
    environment: {
      SteamAPPId: '611670',
    },
    details: {
      steamAppId: 611670,
      compatibleDownloads: ['skyrimse'],
      supportsESL: () => isESLSupported(context.api),
      nexusPageId: 'skyrimspecialedition',
    }
  });

  context.registerInstaller('skyvr-esl-enabler', 10, testEslEnabler, installEslEnabler);

  context.once(() => {
    context.api.events.on('gamemode-activated', (gameId) => {
      if (gameId !== GAME_ID) {
        context.api.dismissNotification(ESL_NOTIF_ID);
      }
    });
    context.api.onAsync('did-deploy', (profileId, newDeployment) => {
      const state = context.api.getState();
      const profile = selectors.profileById(state, profileId);
      if (profile?.gameId !== GAME_ID) {
        return Promise.resolve();
      }
      const discovery = selectors.discoveryByGame(state, GAME_ID);
      if (!discovery?.path || discovery?.store === 'xbox') {
        // Skyrim VR is currently not on Xbox, but it may be one day!
        return Promise.resolve();
      }

      const deployedFiles = newDeployment[''];
      const modESLEnabler = deployedFiles.find(file => file.relPath.toLowerCase().endsWith(ESL_ENABLER_LIB));
      if (modESLEnabler === undefined) {
        return sortAndResolve(context.api);
      }

      const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
      const mod = Object.values(mods).find(mod => mod.installationPath === modESLEnabler.source);
      if (mod === undefined || mod.attributes.eslEnabler === true) {
        return sortAndResolve(context.api);
      }

      const modAttributes = {
        ...mod.attributes,
        eslEnabler: true,
      };
      context.api.store.dispatch(actions.setModAttributes(GAME_ID, mod.id, modAttributes));
      return sortAndResolve(context.api);
    });
  });

  return true;
}

module.exports = {
  default: main,
};
