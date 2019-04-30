import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setLoginId = safeCreateAction('SET_LOGIN_ID', id => id);

export const setLoginError = safeCreateAction('SET_LOGIN_ERROR', error => error);
