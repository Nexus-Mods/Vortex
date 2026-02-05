import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/deployment";
import { createAction } from "redux-act";

// Action to increment deployment counter after deployment completes
export const incrementDeploymentCounter = createAction(
  "INCREMENT_DEPLOYMENT_COUNTER",
  (gameId: string) => ({ gameId }),
);

// Action to track which profile was last deployed per game
export const setLastDeployedProfile = createAction(
  "SET_LAST_DEPLOYED_PROFILE",
  (gameId: string, profileId: string) => ({ gameId, profileId }),
);

export const deploymentReducer: IReducerSpec = {
  reducers: {
    [actions.setDeploymentNecessary as any]: (state, payload) =>
      setSafe(state, ["needToDeploy", payload.gameId], payload.required),
    [incrementDeploymentCounter as any]: (state, payload) => {
      const current = state.deploymentCounter?.[payload.gameId] || 0;
      return setSafe(state, ["deploymentCounter", payload.gameId], current + 1);
    },
    [setLastDeployedProfile as any]: (state, payload) =>
      setSafe(
        state,
        ["lastDeployedProfile", payload.gameId],
        payload.profileId,
      ),
  },
  defaults: {
    needToDeploy: {},
    deploymentCounter: {},
    lastDeployedProfile: {},
  },
};
