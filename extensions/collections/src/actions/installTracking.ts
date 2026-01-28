import { createAction } from "redux-act";
import { types } from "vortex-api";

export const startInstallSession = createAction(
  "COLLECTION_START_INSTALL_SESSION",
  (
    sessionInfo: Omit<
      types.ICollectionInstallSession,
      "downloadedCount" | "installedCount" | "failedCount" | "skippedCount"
    >,
  ) => sessionInfo,
);

export const updateModStatus = createAction(
  "COLLECTION_UPDATE_MOD_STATUS",
  (sessionId: string, ruleId: string, status: types.CollectionModStatus) => ({
    sessionId,
    ruleId,
    status,
  }),
);

export const markModInstalled = createAction(
  "COLLECTION_MARK_MOD_INSTALLED",
  (sessionId: string, ruleId: string, modId: string) => ({
    sessionId,
    ruleId,
    modId,
  }),
);

export const finishInstallSession = createAction(
  "COLLECTION_FINISH_INSTALL_SESSION",
  (sessionId: string, success: boolean) => ({ sessionId, success }),
);

export const clearOldSessions = createAction(
  "COLLECTION_CLEAR_OLD_SESSIONS",
  (daysOld: number) => ({ daysOld }),
);
