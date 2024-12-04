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
    [actions.setInstalledExtensions as any]: (state, payload) =>
      setSafe(state, ['installed'], payload),
    [actions.setOptionalExtensions as any]: (state, payload) =>
      setSafe(state, ['optional'], payload),
    [actions.setExtensionsUpdate as any]: (state, payload) =>
      setSafe(state, ['updateTime'], payload),
  },
  defaults: {
    available: [],
    installed: {},
    optional: {},
    updateTime: 0,
  },
};

export default sessionReducer;
