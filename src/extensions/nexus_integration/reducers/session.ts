import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setLoginId } from '../actions/session';

/**
 * reducer for changes to the authentication
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setLoginId as any]: (state, payload) =>
     setSafe(state, [ 'loginId' ], payload),
  },
  defaults: {
    loginId: undefined,
  },
};
