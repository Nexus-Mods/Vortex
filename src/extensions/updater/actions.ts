import safeCreateAction from '../../actions/safeCreateAction';

/**
 * changes the 'channel' from which to receive Vortex updates
 * currently either 'beta' or 'stable'
 */
export const setUpdateChannel = safeCreateAction('SET_UPDATE_CHANNEL');
