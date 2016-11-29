import { IMod, ModState } from '../types/IMod';

import { createAction } from 'redux-act';

export const addMod: any = createAction('ADD_MOD',
  (mod: IMod) => mod);

export const removeMod: any = createAction('REMOVE_MOD');

/**
 * clear the mod cache
 */
export const clearMods: any = createAction('CLEAR_MODS');

/**
 * sets the state of a mod (whether it's downloaded, installed, ...)
 */
export const setModState: any = createAction('SET_MOD_STATE',
  (id: string, modState: ModState) => ({ id, modState }));

/**
 * sets the (final) installation path of the mod. This should be set as soon as
 * any data is written to disk so that it can be cleaned/removed in case of an error.
 * The actual path on disk may be a variation of this path during installation.
 */
export const setModInstallationPath: any = createAction('SET_MOD_INSTALLATION_PATH',
  (id: string, installPath: string) => ({ id, installPath }));

/**
 * sets the value of an attribute on a mod
 */
export const setModAttribute: any = createAction('SET_MOD_ATTRIBUTE',
  (id: string, attribute: string, value: any) => ({ id, attribute, value }));
