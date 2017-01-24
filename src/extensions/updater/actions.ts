import safeCreateAction from '../../actions/safeCreateAction';

/**
 * changes the 'channel' from which to receive NMM2 updates
 * currently either 'beta' or 'stable'
 */
export const setUpdateChannel: any = safeCreateAction('SET_UPDATE_CHANNEL');
