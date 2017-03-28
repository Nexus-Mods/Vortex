import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * change a path (base, download or installation) for
 * storing things. Supports placeholders
 */
export const setPath = safeCreateAction('SET_MOD_PATH',
  (gameId: string, key: string, path: string) => ({ gameId, key, path }));

/**
 * sets the activator to use for this game
 */
// TODO we can't just change the activator, we first need to purge an activation made with the
// previous one
export const setActivator = safeCreateAction('SET_ACTIVATOR',
  (gameId: string, activatorId: string) => ({ gameId, activatorId }));

/**
 * sets the updating mods flag
 */
export const setUpdatingMods = safeCreateAction('SET_UPDATING_MODS',
  (gameId: string, updatingMods: boolean) => ({ gameId, updatingMods }));
