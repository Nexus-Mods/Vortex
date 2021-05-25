import safeCreateAction from '../../../actions/safeCreateAction';

import { IMod, IModReference, IModRule, ModState } from '../types/IMod';

import * as reduxAct from 'redux-act';

export const addMod = safeCreateAction('ADD_MOD',
  (gameId: string, mod: IMod) => ({ gameId, mod }));

export const addMods = safeCreateAction('ADD_MODS',
  (gameId: string, mods: IMod[]) => ({ gameId, mods }));

export const removeMod = safeCreateAction('REMOVE_MOD',
  (gameId: string, modId: string) => ({ gameId, modId }));

export const setModArchiveId = safeCreateAction('SET_MOD_ARCHIVEID',
  (gameId: string, modId: string, archiveId: string) => ({ gameId, modId, archiveId }));

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
 * set multiple mod attributes at once
 */
export const setModAttributes = safeCreateAction('SET_MOD_ATTRIBUTES',
  (gameId: string, modId: string, attributes: { [attribute: string]: any }) =>
    ({ gameId, modId, attributes }));

/**
 * sets the type of a mod
 */
export const setModType = safeCreateAction('SET_MOD_TYPE',
  (gameId: string, modId: string, type: string) => ({ gameId, modId, type }));

export const clearModRules = safeCreateAction('CLEAR_MOD_RULE',
  (gameId: string, modId: string) => ({ gameId, modId }));

/**
 * add a dependency rule for this mod
 */
export const addModRule = safeCreateAction('ADD_MOD_RULE',
  (gameId: string, modId: string, rule: IModRule) => ({ gameId, modId, rule }));

/**
 * remove a dependency rule from this mod
 */
export const removeModRule = safeCreateAction('REMOVE_MOD_RULE',
  (gameId: string, modId: string, rule: IModRule) => ({ gameId, modId, rule }));

/**
 * store the mod id for a resolved rule, so we can resolve it quicker and more
 * reliably in the future
 */
export const cacheModReference = safeCreateAction('CACHE_MOD_REFERENCE',
  (gameId: string, modId: string, reference: IModReference, refModId: string) =>
    ({ gameId, modId, reference, refModId }));

export const setINITweakEnabled = safeCreateAction(
    'SET_TWEAK_ENABLED',
    (gameId: string, modId: string, tweak: string, enabled: boolean) =>
        ({gameId, modId, tweak, enabled}));

/**
 * set list of files that will always be provided by this mod, no matter the deployment order
 */
export const setFileOverride = safeCreateAction('SET_FILE_OVERRIDE',
  (gameId: string, modId: string, files: string[]) => ({ gameId, modId, files }));
