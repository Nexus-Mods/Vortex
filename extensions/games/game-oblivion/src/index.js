const path = require('path');
const { log, util } = require('vortex-api');

// List of folders in the various languages on Xbox, for now we default to English but this could be enhanced to select a folder based on the Vortex locale.
// It's possible that some mods don't work with the non-English variant. 
// Structure is {GAME FOLDER}\Content\{LANGUAGE FOLDER}
const localeFoldersXbox = {
  en: 'Oblivion GOTY English',
  fr: 'Oblivion GOTY French',
  de: 'Oblivion GOTY German',
  it: 'Oblivion GOTY Italian',
  es: 'Oblivion GOTY Spanish',
}


// In case the findByName functionality doesn't work properly.
//  It didn't seem to when we last checked (01/06/2022) due to
//  a trailing ' ' in the Steam manifest file.
const GAME_ID = 'oblivion';
const STEAMAPP_ID = '22330';
const STEAMAPP_ID2 = '900883';
const GOG_ID = '1458058109';
const MS_ID = 'BethesdaSoftworks.TESOblivion-PC';

const gameStoreIds = {
  steam: [{ id: STEAMAPP_ID, prefer: 0 }, { id: STEAMAPP_ID2 }, { name: 'The Elder Scrolls IV: Oblivion' }],
  xbox: [{ id: MS_ID }],
  gog: [{ id: GOG_ID }],
  registry: [{ id: 'HKEY_LOCAL_MACHINE:Software\\Wow6432Node\\Bethesda Softworks\\oblivion:Installed Path' }],
};

async function findGame() {
  const storeGames = await util.GameStoreHelper.find(gameStoreIds).catch(() => []);

  if (!storeGames.length) return;
  
  if (storeGames.length > 1) log('debug', 'Mutliple copies of Oblivion found', storeGames.map(s => s.gameStoreId));

  const selectedGame = storeGames[0];
  if (['epic', 'xbox'].includes(selectedGame.gameStoreId)) {
    // Get the user's chosen language
    // state.interface.language || 'en';
    log('debug', 'Defaulting to the English game version', { store: selectedGame.gameStoreId, folder: localeFoldersXbox['en'] });
    selectedGame.gamePath = path.join(selectedGame.gamePath, localeFoldersXbox['en']);
  }

  return selectedGame;
}

const tools = [
  {
    id: 'TES4Edit',
    name: 'TES4Edit',
    logo: 'tes5edit.png',
    executable: () => 'TES4Edit.exe',
    requiredFiles: [
      'TES4Edit.exe',
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
    id: 'obse',
    name: 'Oblivion Script Extender',
    shortName: 'OBSE',
    executable: () => 'obse_loader.exe',
    requiredFiles: [
      'obse_loader.exe',
    ],
    relative: true,
    exclusive: true,
  },
];

// we can run the xbox version of Oblivion directly and that ensures we start the language version
// the user is modding
/*
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

  if (store !== undefined) {
    if (store === 'xbox') return xboxSettings;
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
*/

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
              bbcode: '{{gameName}} has multiple language options when downloaded from {{storeName}}. [br][/br][br][/br]' +
                'Vortex has selected the English variant by default. [br][/br][br][/br]' +
                'If you would prefer to manage a different language you can change the path to the game using the "Manually Set Location" option in the games tab.',
              parameters: { gameName, storeName }
            }, [
              { label: 'Close', action: () => api.suppressNotification(`${GAME_ID}-locale-message`) },
            ]
            );
          }
        }
      ]
    });
  }
  return Promise.resolve();
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Oblivion',
    setup: (discovery) => prepareForModding(context.api, discovery),
    mergeMods: true,
    queryPath: findGame,
    supportedTools: tools,
    queryModPath: () => 'Data',
    logo: 'gameart.jpg',
    executable: () => 'oblivion.exe',
    requiredFiles: [
      'oblivion.exe',
    ],
    environment: {
      SteamAPPId: '22330',
    },
    details: {
      steamAppId: 22330,
      hashFiles: [
        'Data/Oblivion.esm'
      ],
    },
  });
  return true;
}

module.exports = {
  default: main
};
