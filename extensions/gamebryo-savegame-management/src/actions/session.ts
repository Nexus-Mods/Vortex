import { safeCreateAction } from 'nmm-api';

import { SavegameState } from '../types/ISavegame';

export const setSavegames: any = safeCreateAction('SET_SAVEGAMES');

export const setSavegameState: any = safeCreateAction('SET_SAVEGAME_STATE',
  (id: string, savegameState: SavegameState) => ({ id, savegameState }));

export const setSavegameAttribute: any = safeCreateAction('SET_SAVEGAME_ATTRIBUTE',
  (id: string, attribute: string, value: any) => ({ id, attribute, value }));

export const clearSavegames: any = safeCreateAction('CLEAR_SAVEGAMES');

export const removeSavegame: any = safeCreateAction('REMOVE_SAVEGAME');
