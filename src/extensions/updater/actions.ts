import { createAction } from 'redux-act';

/**
 * changes the 'channel' from which to receive NMM2 updates
 * currently either 'beta' or 'stable'
 */
export const setUpdateChannel: any = createAction('SET_UPDATE_CHANNEL');
