const Promise = require('bluebird');
const path = require('path');
const { fs, util, log } = require('vortex-api');
const STEAMAPP_ID = '22300';
const STEAMAPP_ID2 = '22370';
const GOG_ID = '1454315831';
const EPIC_ID = 'adeae8bbfc94427db57c7dfecce3f1d4';
const MS_ID = 'BethesdaSoftworks.Fallout3';

const GAME_ID = 'fallout3';

const gameStoreIds = {
  steam: [{ id: STEAMAPP_ID, prefer: 0 }, { id: STEAMAPP_ID2 }, { name: 'Fallout 3.*' }],
  xbox: [{ id: MS_ID }],
  gog: [{ id: GOG_ID }],
  epic: [{ id: EPIC_ID }],
  registry: [{ id: 'HKEY_LOCAL_MACHINE:Software\\Wow6432Node\\Bethesda Softworks\\Fallout3:Installed Path' }],
};

const tools = [
  {
    id: 'FO3Edit',
    name: 'FO3Edit',
    logo: 'fo3edit.png',
    executable: () => 'FO3Edit.exe',
    requiredFiles: [
      'FO3Edit.exe',
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
    id: 'fose',
    name: 'Fallout Script Extender',
    shortName: 'FOSE',
    executable: () => 'fose_loader.exe',
    requiredFiles: [
      'fose_loader.exe',
      'Data/fallout3.esm',
    ],
    relative: true,
    exclusive: true,
    defaultPrimary: true
  }
];

// List of folders in the various languages on Epic, for now we default to English but this could be enhanced to select a folder based on the Vortex locale.
// It's possible that some mods don't work with the non-English variant. 
// Structure is {GAME FOLDER}\{LANGUAGE FOLDER}
const localeFoldersEpic = {
  en: 'Fallout 3 GOTY English',
  fr: 'Fallout 3 GOTY French',
  de: 'Fallout 3 GOTY German',
  it: 'Fallout 3 GOTY Italian',
  es: 'Fallout 3 GOTY Spanish',
};

// List of folders in the various languages on Xbox, for now we default to English but this could be enhanced to select a folder based on the Vortex locale.
// It's possible that some mods don't work with the non-English variant. 
// Structure is {GAME FOLDER}\Content\{LANGUAGE FOLDER}
const localeFoldersXbox = {
  en: 'Fallout 3 GOTY English',
  fr: 'Fallout 3 GOTY French',
  de: 'Fallout 3 GOTY German',
  it: 'Fallout 3 GOTY Italian',
  es: 'Fallout 3 GOTY Spanish',
}

async function findGame() {
  const storeGames = await util.GameStoreHelper.find(gameStoreIds).catch(() => []);

  if (!storeGames.length) return;
  
  if (storeGames.length > 1) log('debug', 'Mutliple copies of Fallout 3 found', storeGames.map(s => s.gameStoreId));

  const selectedGame = storeGames[0];
  if (['epic', 'xbox'].includes(selectedGame.gameStoreId)) {
    const folderList = selectedGame.gameStoreId === 'epic' ? localeFoldersEpic : localeFoldersXbox;
    // Get the user's chosen language
    // state.interface.language || 'en';
    log('debug', 'Defaulting to the English game version', { store: selectedGame.gameStoreId, folder: folderList['en'] });
    selectedGame.gamePath = path.join(selectedGame.gamePath, folderList['en']);
  }
  return selectedGame;
}

function prepareForModding(api, discovery) {
  const gameName = util.getGame(GAME_ID)?.name || 'This game';

  if (discovery.store && ['epic', 'xbox'].includes(discovery.store)) {
    const storeName = discovery.store === 'epic' ? 'Epic Games' : 'Xbox Game Pass';
    // If this is an Epic or Xbox game we've defaulted to English, so we should let the user know.
    api.sendNotification({
      id: `${GAME_ID}-locale-message`,
      type: 'info',
      title: 'Multiple Languages Available',
      message: 'Default: English',
      allowSuppress: true,
      actions: [
        {
          title: 'More',
          action: (dismiss) => {
            dismiss();
            api.showDialog('info', 'Mutliple Languages Available', {
              bbcode: '{{gameName}} has multiple language options when downloaded from {{storeName}}. [br][/br][br][/br]'+
                'Vortex has selected the English variant by default. [br][/br][br][/br]'+
                'If you would prefer to manage a different language you can change the path to the game using the "Manually Set Location" option in the games tab.',
              parameters: { gameName, storeName }
            }, 
            [ 
              { label: 'Close', action: () => api.suppressNotification(`${GAME_ID}-locale-message`) }
            ]
            );
          }
        }
      ]
    });
  }
  return Promise.resolve();
}

async function requiresLauncher(gamePath, store) {
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

  if (store !== undefined) {
    if (store === 'xbox') return xboxSettings;
    if (store === 'epic') return epicSettings;
    else return undefined;
  }

  // Store type isn't detected. Try and match the Xbox path. 

  try {
    const game = await util.GameStoreHelper.findByAppId([MS_ID], 'xbox');
    const normalizeFunc = await util.getNormalizeFunc(gamePath);
    if (normalizeFunc(game.gamePath) === normalizeFunc(gamePath)) return xboxSettings;
    else return undefined;
  }
  catch(err) {
    return undefined;
  }
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Fallout 3',
    mergeMods: true,
    setup: (discovery) => prepareForModding(context.api, discovery),
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'Data',
    requiresLauncher,
    logo: 'gameart.jpg',
    executable: (discoveryPath) => {
      if (discoveryPath === undefined) {
        return 'fallout3.exe';
      } else {
        try {
          fs.statSync(path.join(discoveryPath, 'fallout3ng.exe'));
          return 'fallout3ng.exe';
        } catch (err) {
          return 'fallout3.exe';
        }
      }
    },
    requiredFiles: [
      'Data/fallout3.esm'
    ],
    environment: {
      SteamAPPId: '22300',
    },
    details: {
      steamAppId: 22300,
      hashFiles: ['Data/Fallout3.esm'],
    }
  });

  return true;
}

module.exports = {
  default: main,
};
