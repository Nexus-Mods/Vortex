import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setLastUpdateCheck, setLoginId } from '../actions/session';

/**
 * reducer for changes to the authentication
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setLoginId as any]: (state, payload) =>
     setSafe(state, [ 'loginId' ], payload),
    [setLastUpdateCheck as any]: (state, payload) =>
      setSafe(state, ['lastUpdate', payload.gameId], {
        time: payload.time,
        updateList: payload.updateList,
        range: payload.range,
      }),
  },
  defaults: {
    loginId: undefined,
    lastUpdate: {},
  },
};
