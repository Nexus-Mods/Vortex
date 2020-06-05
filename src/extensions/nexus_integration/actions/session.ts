import safeCreateAction from '../../../actions/safeCreateAction';

import { IUpdateEntry } from '@nexusmods/nexus-api';
import * as reduxAct from 'redux-act';

export const setLoginId = safeCreateAction('SET_LOGIN_ID', id => id);

export const setLoginError = safeCreateAction('SET_LOGIN_ERROR', error => error);

/**
 * store last time we checked for updates
 */
export const setLastUpdateCheck = safeCreateAction('SET_LAST_UPDATE_CHECK',
  (gameId: string, time: number, range: number, updateList: IUpdateEntry[]) =>
    ({ gameId, time, range, updateList }));
