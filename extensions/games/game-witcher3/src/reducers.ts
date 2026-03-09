import { types, util } from 'vortex-api';
import { setPriorityType, setSuppressModLimitPatch } from './actions';

// reducer
export const W3Reducer: types.IReducerSpec = {
  reducers: {
    [setPriorityType as any]: (state, payload) => {
      return util.setSafe(state, ['prioritytype'], payload);
    },
    [setSuppressModLimitPatch as any]: (state, payload) => {
      return util.setSafe(state, ['suppressModLimitPatch'], payload);
    },
  },
  defaults: {
    prioritytype: 'prefix-based',
    suppressModLimitPatch: false,
  },
};
