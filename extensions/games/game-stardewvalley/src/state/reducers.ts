/**
 * Defines Redux reducer state and handlers for Stardew Valley settings.
 */
import { types, util } from "@nexusmods/vortex-api";

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

const sdvReducers: types.IReducerSpec<IStateSDV> = util.actionsToReducerSpec<
  IStateSDV,
  typeof actions
>({ useRecommendations: false }, actions, {
  setRecommendations: (state, payload) => util.setSafe(state, ["useRecommendations"], payload),
  setMergeConfigs: (state, payload) => {
    const { profileId, enabled } = payload;
    return util.setSafe(state, ["mergeConfigs", profileId], enabled);
  },
});

/** Reducer spec mounted as `settings.SDV` by the extension bootstrap. */
export default sdvReducers;
