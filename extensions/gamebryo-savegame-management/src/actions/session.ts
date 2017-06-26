import { createAction } from 'redux-act';

import { SavegameState } from '../types/ISavegame';

export const setSavegames = createAction('SET_SAVEGAMES');

export const setSavegameState = createAction('SET_SAVEGAME_STATE',
  (id: string, savegameState: SavegameState) => ({ id, savegameState }));

export const setSavegameAttribute = createAction('SET_SAVEGAME_ATTRIBUTE',
  (id: string, attribute: string, value: any) => ({ id, attribute, value }));

export const clearSavegames = createAction('CLEAR_SAVEGAMES');

export const removeSavegame = createAction('REMOVE_SAVEGAME');

export const setSavegamePath = createAction('SET_SAVEGAME_PATH');

export const showTransferDialog = createAction('SHOW_TRANSFER_DIALOG');
