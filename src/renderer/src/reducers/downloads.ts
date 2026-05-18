import type { DownloadCheckpoint } from "@vortex/shared/download";

import { clearDownloadCheckpoint, setDownloadCheckpoint } from "../actions/downloads";
import type { IReducerSpec } from "../types/IExtensionContext";

type CheckpointsState = {
  checkpoints: Record<string, DownloadCheckpoint<string>>;
};

export const downloadsReducer: IReducerSpec = {
  reducers: {
    [setDownloadCheckpoint.getType()]: (
      state: CheckpointsState,
      payload: ReturnType<typeof setDownloadCheckpoint>["payload"],
    ): CheckpointsState => ({
      ...state,
      checkpoints: { ...state.checkpoints, [payload.id]: payload.checkpoint },
    }),
    [clearDownloadCheckpoint.getType()]: (
      state: CheckpointsState,
      payload: ReturnType<typeof clearDownloadCheckpoint>["payload"],
    ): CheckpointsState => {
      const { [payload.id]: _, ...rest } = state.checkpoints;
      return { ...state, checkpoints: rest };
    },
  },
  defaults: {
    checkpoints: {},
  },
};
