import { createAction } from "redux-act";

import type { DownloadCheckpoint } from "@vortex/shared/download";

export const setDownloadCheckpoint = createAction(
  "SET_DOWNLOAD_CHECKPOINT",
  (id: string, checkpoint: DownloadCheckpoint<string>) => ({ id, checkpoint }),
);

export const clearDownloadCheckpoint = createAction(
  "CLEAR_DOWNLOAD_CHECKPOINT",
  (id: string) => ({ id }),
);
