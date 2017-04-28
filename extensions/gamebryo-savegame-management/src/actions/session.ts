import { safeCreateAction } from 'nmm-api';

import { SavegameState } from '../types/ISavegame';

export const setSavegames = safeCreateAction('SET_SAVEGAMES');

export const setSavegameState = safeCreateAction('SET_SAVEGAME_STATE',
  (id: string, savegameState: SavegameState) => ({ id, savegameState }));

export const setSavegameAttribute = safeCreateAction('SET_SAVEGAME_ATTRIBUTE',
  (id: string, attribute: string, value: any) => ({ id, attribute, value }));

export const clearSavegames = safeCreateAction('CLEAR_SAVEGAMES');

export const removeSavegame = safeCreateAction('REMOVE_SAVEGAME');

export const setSavegamePath = safeCreateAction('SET_SAVEGAME_PATH');

export const showSavegamesDialog = safeCreateAction('SHOW_SAVEGAMES_DIALOG');

export const setSelectAllSavegames = safeCreateAction('SELECT_ALL_SAVEGAMES');

export const setSelectedProfile = safeCreateAction('SET_SELECTED_PROFILE');
