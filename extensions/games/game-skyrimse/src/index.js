const { getFileVersion, getFileVersionLocalized } = require('exe-version');
const path = require('path');
const { fs, selectors, util } = require('vortex-api');

const GAME_ID = 'skyrimse';
const GOG_ID = '1711230643';
const MS_ID = 'BethesdaSoftworks.SkyrimSE-PC';
const EPIC_ID = 'ac82db5035584c7f8a2c548d98c86b2c';
const STEAM_ID = '489830';

const tools = [
  {
    id: 'SSEEdit',
    name: 'SSEEdit',
    logo: 'tes5edit.png',
    executable: () => 'SSEEdit.exe',
    requiredFiles: [
      'SSEEdit.exe',
    ],
  },
  {
    id: 'WryeBash',
    name: 'Wrye Bash',
    logo: 'wrye.png',
    executable: () => 'Wrye Bash.exe',
    requiredFiles: [
      'Wrye Bash.exe',
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
    id: 'skse64',
    name: 'Skyrim Script Extender 64',
    shortName: 'SKSE64',
    logo: 'SKSE.png',
    executable: () => 'skse64_loader.exe',
    requiredFiles: [
      'skse64_loader.exe',
    ],
    relative: true,
    exclusive: true,
    defaultPrimary: true,
  },
  {
    id: 'bodyslide',
    name: 'BodySlide',
    executable: () => path.join('Data', 'CalienteTools', 'BodySlide', 'BodySlide x64.exe'),
    requiredFiles: [
      path.join('Data', 'CalienteTools', 'BodySlide', 'BodySlide x64.exe'),
    ],
    relative: true,
    logo: 'auto',
  },
  {
    id: 'creation-kit-64',
    name: 'Creation Kit',
    executable: () => 'CreationKit.exe',
    logo: 'CK.png',
    relative: true,
    requiredFiles: [
      'CreationKit.exe',
    ],
  }
];

function requiresLauncher(gamePath, store) {
  const xboxSettings = {
    launcher: 'xbox',
    addInfo: {
      appId: MS_ID,
      parameters: [
        { appExecName: 'Game' },
      ],
    }
  };
  const epicSettings = {
    launcher: 'epic',
    addInfo: {
      appId: EPIC_ID,
    }
  };
  if (store !== undefined) { // early out if the app gave us the storeid
    if (store === 'xbox') {
      return Promise.resolve(xboxSettings);
    } else if (store === 'epic') {
      return Promise.resolve(epicSettings);
    } else {
      return Promise.resolve(undefined);
    }
  }

  let normalize;

  return util.GameStoreHelper.findByAppId([MS_ID], 'xbox')
    .then(gameEntry => {
      util.getNormalizeFunc(gamePath)
        .then(norm => normalize = norm);
      return gameEntry;
    })
    .then(gameEntry => {
      if (normalize(gameEntry.gamePath) === normalize(gamePath)) {
        return Promise.resolve(xboxSettings);
      }
    })
    .catch(() => Promise.resolve(undefined));
}

async function getGameVersion(api, gamePath, exePath) {
  const appManifest = path.join(gamePath, 'appxmanifest.xml');
  try {
    await fs.statAsync(appManifest);
    if (api.ext?.['getHashVersion']) {
      const state = api.getState();
      const game = selectors.gameById(state, GAME_ID);
      const discovery = selectors.discoveryByGame(state, GAME_ID);
      return new Promise((resolve, reject) => {
        api.ext?.['getHashVersion'](game, discovery, (err, ver) => {
          return err !== null
            ? reject(err)
            : resolve(ver);
        });
      }); 
    } else {
      throw new util.NotSupportedError();
    }
  } catch (err) {
    const fullPath = path.join(gamePath, exePath);
    const fileVersion = getFileVersion(fullPath);
    return (fileVersion !== '1.0.0.0')
      ? fileVersion
      : getFileVersionLocalized(fullPath);
  }
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Skyrim Special Edition',
    shortName: 'SSE',
    mergeMods: true,
    queryArgs: {
      // prefer steam because it was released first and users may have pre-1.6.12 installs with store not saved in state
      steam: [{ name: 'The Elder Scrolls V: Skyrim Special Edition', prefer: 0 }],
      xbox: [{ id: MS_ID }],
      gog: [{ id: GOG_ID }],
      epic: [{ id: EPIC_ID }],
      registry: [{ id: 'HKEY_LOCAL_MACHINE:Software\\Wow6432Node\\Bethesda Softworks\\Skyrim Special Edition:Installed Path' }],
    },
    supportedTools: tools,
    queryModPath: () => 'Data',
    logo: 'gameart.jpg',
    executable: () => 'SkyrimSE.exe',
    requiredFiles: [
      'SkyrimSE.exe',
    ],
    requiresLauncher,
    getGameVersion: (gamePath, exePath) => getGameVersion(context.api, gamePath, exePath),
    environment: {
      SteamAPPId: STEAM_ID,
      GogAPPId: GOG_ID,
      XboxAPPId: MS_ID,
      EpicAPPId: EPIC_ID,
    },
    details: {
      steamAppId: +STEAM_ID,
      gogAppId: GOG_ID,
      xboxAppId: MS_ID,
      epicAppId: EPIC_ID,
      nexusPageId: 'skyrimspecialedition',
      hashFiles: [
        'appxmanifest.xml',
        path.join('Data', 'Skyrim.esm'),
        path.join('Data', 'Update.esm'),
      ],
    }
  });

  return true;
}

module.exports = {
  default: main,
};
