import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * Used to track transfer attempts and correctly recover if it gets interrupted.
 */
export const setTransferDownloads = safeCreateAction('SET_TRANSFER_DOWNLOADS',
  (destination: string) => ({ destination }));
