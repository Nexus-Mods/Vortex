import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

/*
 * associate with nxm urls
 */
export const setLoginId = safeCreateAction('SET_LOGIN_ID', id => id);
