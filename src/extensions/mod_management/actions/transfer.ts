import safeCreateAction from '../../../actions/safeCreateAction';

export const setTransferMods = safeCreateAction('SET_TRANSFER_MODS',
  (gameId: string, destination: string) => ({ gameId, destination }));
