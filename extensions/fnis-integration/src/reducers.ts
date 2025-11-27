import * as actions from './actions';
import { types, util } from 'vortex-api';

/**
 * reducer for changes to ephemeral session state
 */
const settingsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setAutoRun as any]: (state, payload) =>
      util.setSafe(state, ['autoRun'], payload),
    [actions.setPatches as any]: (state, payload) =>
      util.setSafe(state, ['patches', payload.profileId], payload.patches),
    [actions.setNeedToRun as any]: (state, payload) =>
      util.setSafe(state, ['needToRun', payload.profileId], payload.force),
  },
  defaults: {
    autoRun: false,
    patches: {},
    needToRun: {},
  },
};

export default settingsReducer;
