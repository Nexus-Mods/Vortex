/**
 * Defines Redux reducer state and handlers for Stardew Valley settings.
 */
import type { types} from 'vortex-api';

import { util } from 'vortex-api';

import * as actions from './actions';

/** Shape of `settings.SDV` reducer state. */
export interface IStateSDV {
  useRecommendations: boolean;
  mergeConfigs?: { [profileId: string]: boolean };
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
    useRecommendations: false,
  },
}

// Needed because the API expects the generic IReducerSpec
/** Reducer spec mounted as `settings.SDV` by the extension bootstrap. */
export default sdvReducers as unknown as types.IReducerSpec;
