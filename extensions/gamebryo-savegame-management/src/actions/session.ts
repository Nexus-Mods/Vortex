import { createAction } from 'redux-act';

import { SavegameState } from '../types/ISavegame';

export const setSavegames: any = createAction('SET_SAVEGAMES');

export const setSavegameState: any = createAction('SET_SAVEGAME_STATE',
  (id: string, savegameState: SavegameState) => ({ id, savegameState }));

export const setSavegameAttribute: any = createAction('SET_SAVEGAME_ATTRIBUTE',
  (id: string, attribute: string, value: any) => ({ id, attribute, value }));

export const clearSavegames: any = createAction('CLEAR_SAVEGAMES');

export const removeSavegame: any = createAction('REMOVE_SAVEGAME');
