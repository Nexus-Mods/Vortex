import safeCreateAction from '../../../actions/safeCreateAction';

import { IUpdateEntry } from 'nexus-api';
import * as reduxAct from 'redux-act';

/*
 * associate with nxm urls
 */
export const setLoginId = safeCreateAction('SET_LOGIN_ID', id => id);

/**
 * store last time we checked for updates
 */
export const setLastUpdateCheck = safeCreateAction('SET_LAST_UPDATE_CHECK',
  (gameId: string, time: number, range: number, updateList: IUpdateEntry[]) =>
    ({ gameId, time, range, updateList }));
