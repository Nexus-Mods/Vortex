import { IReducerSpec } from '../../types/IExtensionContext';
import { setSafe } from '../../util/storeHelper';

import * as actions from './actions';

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.showURL as any]: (state, payload) =>
      setSafe(state, ['url'], payload),
    [actions.closeBrowser as any]: (state, payload) =>
      setSafe(state, ['url'], undefined),
  },
  defaults: {
    url: undefined,
  },
};
