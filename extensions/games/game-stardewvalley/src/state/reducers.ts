/**
 * Defines Redux reducer state and handlers for Stardew Valley settings.
 */
import type { types } from "@nexusmods/vortex-api";
import { util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

/** Shape of `settings.SDV` reducer state. */
export interface IStateSDV {
  useRecommendations: boolean;
  mergeConfigs?: { [profileId: string]: boolean };
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISettings {
      SDV: IStateSDV;
    }
  }
}

const sdvReducers: types.IReducerSpec<IStateSDV> = {
  reducers: {
    [actions.setRecommendations as any]: (state: IStateSDV, payload: boolean) => {
      return util.setSafe(state, ["useRecommendations"], payload);
    },
    [actions.setMergeConfigs as any]: (
      state: IStateSDV,
      payload: { profileId: string; enabled: boolean },
    ) => {
      const { profileId, enabled } = payload;
      return util.setSafe(state, ["mergeConfigs", profileId], enabled);
    },
  },
  defaults: {
    useRecommendations: false,
  },
};

/** Reducer spec mounted as `settings.SDV` by the extension bootstrap. */
export default sdvReducers;
