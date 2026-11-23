import update from "immutability-helper";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/installerUI";
import type { IFOMODState, IFOMODStateDialog } from "../types/interface";

declare module "@/types/IState" {
  interface ISessionState {
    fomod: IFOMODState;
  }
}

export const installerUIReducer = actionsToReducerSpec<IFOMODStateDialog, typeof actions>(
  {
    activeInstanceId: null,
    instances: {},
  },
  actions,
  {
    startDialog: (state, payload) => {
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
    endDialog: (state, payload) => {
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
    clearDialog: (state, payload) => {
      const { instanceId } = payload;

      return update(state, {
        instances: { $unset: [instanceId] },
      });
    },
    setDialogState: (state, payload) => {
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
  },
);
