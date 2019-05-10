import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setLastUpdateCheck, setLoginError, setLoginId } from '../actions/session';

/**
 * reducer for changes to the authentication
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setLoginId as any]: (state, payload) => {
      // also reset login errors when login gets closed
      const temp = (payload === undefined) 
        ? setSafe(state, ['loginError'], undefined)
        : state;
      return setSafe(temp, [ 'loginId' ], payload);
    },
    [setLoginError as any]: (state, payload) =>
     setSafe(state, [ 'loginError' ], payload),
    [setLastUpdateCheck as any]: (state, payload) =>
      setSafe(state, ['lastUpdate', payload.gameId], {
        time: payload.time,
        updateList: payload.updateList,
        range: payload.range,
      }),
  },
  defaults: {
    loginId: undefined,
    loginError: undefined,
    lastUpdate: {},
  },
};
