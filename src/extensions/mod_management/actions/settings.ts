import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

/**
 * change the mod install path. Supports placeholders
 */
export const setInstallPath = safeCreateAction('SET_MOD_INSTALL_PATH',
  (gameId: string, path: string) => ({ gameId, path }));

/**
 * sets the activator to use for this game
 */
export const setActivator = safeCreateAction('SET_ACTIVATOR',
  (gameId: string, activatorId: string) => ({ gameId, activatorId }));

/**
 * sets the updating mods flag
 */
export const setUpdatingMods = safeCreateAction('SET_UPDATING_MODS',
  (gameId: string, updatingMods: boolean) => ({ gameId, updatingMods }));

export const setShowModDropzone = safeCreateAction('SET_SHOW_MOD_DROPZONE',
  show => show);

export const setConfirmPurge = safeCreateAction('SET_CONFIRM_PURGE',
  (confirm: boolean) => confirm);
