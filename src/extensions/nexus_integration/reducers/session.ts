import { IReducerSpec } from '../../../types/IExtensionContext';
import { addUniqueSafe, removeValue, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/session';

/**
 * reducer for changes to the authentication
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setLoginId as any]: (state, payload) => {
      // also reset login errors when login gets closed
      const temp = (payload === undefined)
        ? setSafe(state, ['loginError'], undefined)
        : state;
      return setSafe(temp, [ 'loginId' ], payload);
    },
    [actions.setLoginError as any]: (state, payload) =>
     setSafe(state, [ 'loginError' ], payload),
    [actions.setLastUpdateCheck as any]: (state, payload) =>
      setSafe(state, ['lastUpdate', payload.gameId], {
        time: payload.time,
        updateList: payload.updateList,
        range: payload.range,
      }),
    [actions.addFreeUserDLItem as any]: (state, payload) =>
      addUniqueSafe(state, ['freeUserDLQueue'], payload),
    [actions.removeFreeUserDLItem as any]: (state, payload) =>
      removeValue(state, ['freeUserDLQueue'], payload),
    [actions.setOauthPending as any]: (state, payload) =>
      setSafe(state, [ 'oauthPending' ], payload),
  },
  defaults: {
    loginId: undefined,
    loginError: undefined,
    lastUpdate: {},
    freeUserDLQueue: [],
  },
};
