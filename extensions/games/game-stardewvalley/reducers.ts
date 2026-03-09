import * as actions from './actions';

import { types, util } from 'vortex-api';

export interface IStateSDV {
  useRecommendations: boolean;
}

const sdvReducers: types.IReducerSpec<IStateSDV> = {
  reducers: {
    [actions.setRecommendations as any]: (state, payload) => {
      return util.setSafe(state, ['useRecommendations'], payload);
    },
    [actions.setMergeConfigs as any]: (state, payload) => {
      const { profileId, enabled } = payload;
      return util.setSafe(state, ['mergeConfigs', profileId], enabled);
    },
  },
  defaults: {
    useRecommendations: undefined,
  },
}

export default sdvReducers;
