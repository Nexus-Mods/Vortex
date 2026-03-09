import path from 'path';
import { actions, log, selectors, types, util } from 'vortex-api';
import * as React from 'react';

const walk = require('turbowalk').default;

import { validate, deserializeLoadOrder, serializeLoadOrder } from './loadorder';
import { MORROWIND_ID } from './constants';

import { IExtendedInterfaceProps } from './types/types';

import { genCollectionsData, parseCollectionsData } from './collections';

import MorrowindCollectionsDataView from './views/MorrowindCollectionsDataView';

import { migrate103 } from './migrations';

const STEAMAPP_ID = '22320';
const GOG_ID = '1435828767';
const MS_ID = 'BethesdaSoftworks.TESMorrowind-PC';

const GAME_ID = MORROWIND_ID;

const localeFoldersXbox = {
  en: 'Morrowind GOTY English',
  fr: 'Morrowind GOTY French',
  de: 'Morrowind GOTY German',
}

const gameStoreIds: any = {
  steam: [{ id: STEAMAPP_ID, prefer: 0 }],
  xbox: [{ id: MS_ID }],
  gog: [{ id: GOG_ID }],
  registry: [{ id: 'HKEY_LOCAL_MACHINE:Software\\Wow6432Node\\Bethesda Softworks\\Morrowind:Installed Path' }],
};

const tools = [
  {
    id: 'tes3edit',
    name: 'TES3Edit',
    executable: () => 'TES3Edit.exe',
    requiredFiles: []
  },
  {
    id: 'mw-construction-set',
    name: 'Construction Set',
    logo: 'constructionset.png',
    executable: () => 'TES Construction Set.exe',
    requiredFiles: [
      'TES Construction Set.exe',
    ],
    relative: true,
    exclusive: true
  }
];

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

/* Morrowind seems to start fine when running directly. If we do go through the launcher then the language version being
   started might not be the one we're modding

function requiresLauncher(gamePath) {
  return util.GameStoreHelper.findByAppId([MS_ID], 'xbox')
    .then(() => Promise.resolve({
      launcher: 'xbox',
      addInfo: {
        appId: MS_ID,
        parameters: [
          { appExecName: 'Game' },
        ],
      }
    }))
    .catch(err => Promise.resolve(undefined));
}
*/

function prepareForModding(api: types.IExtensionApi, discovery: types.IDiscoveryResult) {
  const gameName = util.getGame(GAME_ID)?.name || 'This game';

  // the game doesn't actually exist on the epic game store, this chunk is copy&pasted, doesn't hurt
  // keeping it identical
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

function CollectionDataWrap(api: types.IExtensionApi, props: IExtendedInterfaceProps): JSX.Element {
  return React.createElement(MorrowindCollectionsDataView, { ...props, api, });
}

function main(context: types.IExtensionContext) {
  context.registerGame({
    id: MORROWIND_ID,
    name: 'Morrowind',
    mergeMods: true,
    queryPath: util.toBlue(findGame),
    supportedTools: tools,
    setup: util.toBlue((discovery) => prepareForModding(context.api, discovery)),
    queryModPath: () => 'Data Files',
    logo: 'gameart.jpg',
    executable: () => 'morrowind.exe',
    requiredFiles: [
      'morrowind.exe',
    ],
    // requiresLauncher,
    environment: {
      SteamAPPId: STEAMAPP_ID,
    },
    details: {
      steamAppId: parseInt(STEAMAPP_ID, 10),
      gogAppId: GOG_ID
    },
  });

  context.registerLoadOrder({
    gameId: MORROWIND_ID,
    deserializeLoadOrder: () => deserializeLoadOrder(context.api),
    serializeLoadOrder: (loadOrder) => serializeLoadOrder(context.api, loadOrder),
    validate,
    noCollectionGeneration: true,
    toggleableEntries: true,
    usageInstructions: 'Drag your plugins as needed - the game will load '
      + 'load them from top to bottom.',
  });

  context.optional.registerCollectionFeature(
    'morrowind_collection_data',
    (gameId, includedMods, collection) =>
      genCollectionsData(context, gameId, includedMods, collection),
    (gameId, collection) =>
      parseCollectionsData(context, gameId, collection),
    () => Promise.resolve(),
    (t) => t('Load Order'),
    (state, gameId) => gameId === MORROWIND_ID,
    (props: IExtendedInterfaceProps) => CollectionDataWrap(context.api, props));

  context.registerMigration(old => migrate103(context.api, old));
  context.once(() => {
    context.api.events.on('did-install-mod', async (gameId, archiveId, modId) => {
      if (gameId !== MORROWIND_ID) {
        return;
      }

      const state = context.api.getState();
      const installPath = selectors.installPathForGame(state, MORROWIND_ID);
      const mod = util.getSafe(state, ['persistent', 'mods', MORROWIND_ID, modId], undefined);
      if (installPath === undefined || mod === undefined) {
        return;
      }
      const modPath = path.join(installPath, mod.installationPath);
      const plugins = [];
      try {
        await walk(modPath, entries => {
          for (let entry of entries) {
            if (['.esp', '.esm'].includes(path.extname(entry.filePath.toLowerCase()))) {
              plugins.push(path.basename(entry.filePath));
            }
          }
        }, { recurse: true, skipLinks: true, skipInaccessible: true });
      } catch (err) {
        context.api.showErrorNotification('Failed to read list of plugins', err, { allowReport: false });
      }
      if ( plugins.length > 0) {
        context.api.store.dispatch(actions.setModAttribute(MORROWIND_ID, mod.id, 'plugins', plugins));
      }
    });
  });

  return true;
}

module.exports = {
  default: main
};
