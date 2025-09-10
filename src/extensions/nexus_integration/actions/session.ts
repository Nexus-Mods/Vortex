import safeCreateAction from '../../../actions/safeCreateAction';

import { IUpdateEntry } from '@nexusmods/nexus-api';
import * as reduxAct from 'redux-act';

export const setLoginId = safeCreateAction('SET_LOGIN_ID', (id: string | undefined) => id);

export const setOauthPending = safeCreateAction('SET_OAUTH_PENDING', (url: string | undefined) => url);

export const setLoginError = safeCreateAction('SET_LOGIN_ERROR', (error: string) => error);

/**
 * store last time we checked for updates
 */
export const setLastUpdateCheck = safeCreateAction('SET_LAST_UPDATE_CHECK',
                                                   (gameId: string, time: number, range: number, updateList: IUpdateEntry[]) =>
                                                     ({ gameId, time, range, updateList }));

export const addFreeUserDLItem = safeCreateAction('ADD_FREEUSER_DLITEM',
                                                  (url: string) => url);

export const removeFreeUserDLItem = safeCreateAction('REMOVE_FREEUSER_DLITEM',
                                                     (url: string) => url);
