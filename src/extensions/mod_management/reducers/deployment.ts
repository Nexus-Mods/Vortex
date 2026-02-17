import type { IReducerSpec } from "../../../renderer/types/IExtensionContext";
import { setSafe } from "../../../renderer/util/storeHelper";
import * as actions from "../actions/deployment";
import { createAction } from "redux-act";

// Action to increment deployment counter after deployment completes
export const incrementDeploymentCounter = createAction(
  "INCREMENT_DEPLOYMENT_COUNTER",
  (gameId: string) => ({ gameId }),
);

export const deploymentReducer: IReducerSpec = {
  reducers: {
    [actions.setDeploymentNecessary as any]: (state, payload) =>
      setSafe(state, ["needToDeploy", payload.gameId], payload.required),
    [incrementDeploymentCounter as any]: (state, payload) => {
      const current = state.deploymentCounter?.[payload.gameId] || 0;
      return setSafe(state, ["deploymentCounter", payload.gameId], current + 1);
    },
  },
  defaults: {
    needToDeploy: {},
    deploymentCounter: {},
  },
};
