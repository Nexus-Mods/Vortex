import safeCreateAction from '../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

/**
 * changes the 'channel' from which to receive Vortex updates
 * currently either 'beta' or 'stable'
 */
export const setUpdateChannel = safeCreateAction('SET_UPDATE_CHANNEL', channel => channel);
