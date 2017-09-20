import safeCreateAction from '../../../actions/safeCreateAction';

import { IMod, ModState } from '../types/IMod';

import { IRule } from 'modmeta-db';

export const addMod = safeCreateAction('ADD_MOD',
  (gameId: string, mod: IMod) => ({ gameId, mod }));

export const addMods = safeCreateAction('ADD_MODS',
  (gameId: string, mods: IMod[]) => ({ gameId, mods }));

export const removeMod = safeCreateAction('REMOVE_MOD',
  (gameId: string, modId: string) => ({ gameId, modId }));

/**
 * sets the state of a mod (whether it's downloaded, installed, ...)
 */
export const setModState = safeCreateAction('SET_MOD_STATE',
  (gameId: string, modId: string, modState: ModState) => ({ gameId, modId, modState }));

/**
 * sets the (final) installation path of the mod. This should be set as soon as
 * any data is written to disk so that it can be cleaned/removed in case of an error.
 * The actual path on disk may be a variation of this path during installation.
 */
export const setModInstallationPath = safeCreateAction('SET_MOD_INSTALLATION_PATH',
  (gameId: string, modId: string, installPath: string) => ({ gameId, modId, installPath }));

/**
 * sets the value of an attribute on a mod
 */
export const setModAttribute = safeCreateAction('SET_MOD_ATTRIBUTE',
  (gameId: string, modId: string, attribute: string, value: any) =>
    ({ gameId, modId, attribute, value }));

/**
 * sets the type of a mod
 */
export const setModType = safeCreateAction('SET_MOD_TYPE',
  (gameId: string, modId: string, type: string) => ({ gameId, modId, type }));

/**
 * add a dependency rule for this mod
 */
export const addModRule = safeCreateAction('ADD_MOD_RULE',
  (gameId: string, modId: string, rule: IRule) => ({ gameId, modId, rule }));

/**
 * remove a dependency rule from this mod
 */
export const removeModRule = safeCreateAction('REMOVE_MOD_RULE',
  (gameId: string, modId: string, rule: IRule) => ({ gameId, modId, rule }));

export const setINITweakEnabled = safeCreateAction(
    'SET_TWEAK_ENABLED',
    (gameId: string, modId: string, tweak: string, enabled: boolean) =>
        ({gameId, modId, tweak, enabled}));
