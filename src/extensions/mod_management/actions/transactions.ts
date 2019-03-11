import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * Used to track transfer attempts and correctly recover if it gets interrupted.
 */
export const setTransferMods = safeCreateAction('SET_TRANSFER_MODS',
  (gameId: string, destination: string) => ({ gameId, destination }));
