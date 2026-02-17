import update from "immutability-helper";

import * as actions from "../actions/installerUI";
import type { IFOMODStateDialog } from "../types/interface";

import type { IReducerSpec } from "../../../renderer/types/api";
import { createReducer } from "../../../renderer/store/reducers";

const defaults: IFOMODStateDialog = {
  activeInstanceId: null,
  instances: {},
};

const reducers: IReducerSpec<IFOMODStateDialog>["reducers"] = {};

createReducer(
  actions.startDialog,
  (state, payload) => {
    const { instanceId, info } = payload;
    const existingInstance = state.instances?.[instanceId];

    return update(state, {
      activeInstanceId: { $set: instanceId },
      instances: {
        [instanceId]: existingInstance
          ? { $merge: { info } }
          : { $set: { info, state: undefined } },
      },
    });
  },
  reducers,
);

createReducer(
  actions.endDialog,
  (state, payload) => {
    const { instanceId } = payload;
    const existingInstance = state.instances?.[instanceId];

    return update(state, {
      activeInstanceId: { $set: null },
      instances: existingInstance
        ? {
            [instanceId]: {
              info: { $set: null },
            },
          }
        : {},
    });
  },
  reducers,
);

createReducer(
  actions.clearDialog,
  (state, payload) => {
    const { instanceId } = payload;

    return update(state, {
      instances: { $unset: [instanceId] },
    });
  },
  reducers,
);

createReducer(
  actions.setDialogState,
  (state, payload) => {
    const { instanceId, dialogState } = payload;
    const existingInstance = state.instances?.[instanceId];

    return update(state, {
      instances: {
        [instanceId]: existingInstance
          ? { $merge: { state: dialogState } }
          : { $set: { info: undefined, state: dialogState } },
      },
    });
  },
  reducers,
);

const reducer: IReducerSpec<IFOMODStateDialog> = {
  reducers,
  defaults,
};

// Needed because the API expects the generic IReducerSpec
export const installerUIReducer = reducer as unknown as IReducerSpec;
