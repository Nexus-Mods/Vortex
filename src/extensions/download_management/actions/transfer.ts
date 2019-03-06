import safeCreateAction from '../../../actions/safeCreateAction';

export const setTransferDownloads = safeCreateAction('SET_TRANSFER_DOWNLOADS',
  (destination: string) => ({ destination }));
