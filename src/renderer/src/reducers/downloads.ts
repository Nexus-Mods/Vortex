import type { DownloadCheckpoint } from "@vortex/shared/download";

import * as actions from "../actions/downloads";
import { actionsToReducerSpec } from "./builder";

interface CheckpointsState {
  checkpoints: Record<string, DownloadCheckpoint<string>>;
}

const defaultState: CheckpointsState = { checkpoints: {} };

export const downloadsReducer = actionsToReducerSpec(defaultState, actions, {
  setDownloadCheckpoint: (state, payload) => ({
    ...state,
    checkpoints: { ...state.checkpoints, [payload.id]: payload.checkpoint },
  }),
  clearDownloadCheckpoint: (state, payload) => {
    const { [payload.id]: _, ...checkpoints } = state.checkpoints;
    return { ...state, checkpoints };
  },
});
