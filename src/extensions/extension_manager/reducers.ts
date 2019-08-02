import { IReducerSpec } from '../../types/IExtensionContext';
import { setSafe } from '../../util/storeHelper';

import * as actions from './actions';

/**
 * reducer for changes to ephemeral session state
 */
const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setAvailableExtensions as any]: (state, payload) =>
      setSafe(state, ['available'], payload),
  },
  defaults: {
    available: [],
  },
};

export default sessionReducer;
