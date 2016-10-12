import { IMod, ModState } from '../types/IMod';

import { createAction } from 'redux-act';

export const addMod = createAction('ADD_MOD',
  (mod: IMod) => mod);

/**
 * clear the mod cache
 */
export const clearMods = createAction('CLEAR_MODS');

/**
 * sets the state of a mod (whether it's downloaded, installed, ...)
 */
export const setModState = createAction('SET_MOD_STATE',
  (id: string, modState: ModState) => { return { id, modState }; });

/**
 * sets the value of an attribute on a mod
 */
export const setModAttribute = createAction('SET_MOD_ATTRIBUTE',
  (id: string, attribute: string, value: any) => { return { id, attribute, value }; });
