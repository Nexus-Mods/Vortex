import { createAction } from "redux-act";

import { actionsToReducerSpec } from "../../../reducers/builder";
import type { IState } from "../../../types/IState";
import * as actions from "../actions/deployment";

// Action to increment deployment counter after deployment completes
export const incrementDeploymentCounter = createAction(
  "INCREMENT_DEPLOYMENT_COUNTER",
  (gameId: string) => ({ gameId }),
);

const defaultState: IState["persistent"]["deployment"] = {
  needToDeploy: {},
  purged: {},
  deploymentCounter: {},
};

export const deploymentReducer = actionsToReducerSpec(
  defaultState,
  { ...actions, incrementDeploymentCounter },
  {
    setDeploymentNecessary: (state, payload) => ({
      ...state,
      needToDeploy: { ...state.needToDeploy, [payload.gameId]: payload.required },
    }),
    setDeploymentPurged: (state, payload) => ({
      ...state,
      purged: { ...state.purged, [payload.gameId]: payload.purged },
    }),
    incrementDeploymentCounter: (state, payload) => ({
      ...state,
      deploymentCounter: {
        ...state.deploymentCounter,
        [payload.gameId]: (state.deploymentCounter?.[payload.gameId] || 0) + 1,
      },
    }),
  },
);
