/* eslint-disable */
import { selectors, types, util } from 'vortex-api';

import { GAME_ID, SCRIPT_MERGER_ID } from '../common';

import { ILoadOrder, IW3CollectionsData, IW3MergedData } from './types';

import { exportLoadOrder, importLoadOrder } from './loadOrder';

import { exportMenuMod, importMenuMod } from '../menumod';
import { exportScriptMerges, importScriptMerges } from '../mergeBackup';

import { downloadScriptMerger } from '../scriptmerger';

import { CollectionParseError, hex2Buffer } from './util';

export async function genCollectionsData(context: types.IExtensionContext,
                                         gameId: string,
                                         includedMods: string[],
                                         collection: types.IMod) {
  const api = context.api;
  const state = api.getState();
  const profile = selectors.activeProfile(state);
  const mods: { [modId: string]: types.IMod } = util.getSafe(state,
    ['persistent', 'mods', gameId], {});
  try {
    const loadOrder: types.LoadOrder = await exportLoadOrder(api, includedMods, mods);
    const menuModData = await exportMenuMod(api, profile, includedMods);
    const scriptMergerTool = util.getSafe(state,
      ['settings', 'gameMode', 'discovered', GAME_ID, 'tools', SCRIPT_MERGER_ID], undefined);
    let scriptMergesData;
    if (scriptMergerTool !== undefined) {
      scriptMergesData = await exportScriptMerges(context.api, profile.id, includedMods, collection);
    }
    const mergedData: IW3MergedData = {
      menuModSettingsData: (menuModData !== undefined)
        ? menuModData.toString('hex')
        : undefined,
      scriptMergedData: scriptMergesData !== undefined
        ? scriptMergesData.toString('hex')
        : undefined,
    };
    const collectionData: IW3CollectionsData = {
      loadOrder: loadOrder as any,
      mergedData,
    };
    return Promise.resolve(collectionData);
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function parseCollectionsData(context: types.IExtensionContext,
                                           gameId: string,
                                           collection: IW3CollectionsData) {
  const api = context.api;
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== gameId) {
    const collectionName = collection['info']?.['name'] !== undefined ? collection['info']['name'] : 'Witcher 3 Collection';
    return Promise.reject(new CollectionParseError(collectionName,
      'Last active profile is missing'));
  }
  const { menuModSettingsData, scriptMergedData } = collection.mergedData;
  try {
    await importLoadOrder(api, collection);
    if (menuModSettingsData !== undefined) {
      await importMenuMod(api, profile, hex2Buffer(menuModSettingsData));
    }

    if (scriptMergedData !== undefined) {
      // Make sure we have the script merger installed straight away!
      const scriptMergerTool = util.getSafe(state,
        ['settings', 'gameMode', 'discovered', GAME_ID, 'tools', SCRIPT_MERGER_ID], undefined);
      if (scriptMergerTool === undefined) {
        await downloadScriptMerger(api);
      }
      await importScriptMerges(context.api, profile.id, hex2Buffer(scriptMergedData));
    }
  } catch (err) {
    return Promise.reject(err);
  }
}
