import { types, util } from "vortex-api";
import * as actions from "../actions/installTracking";

// Initial state
const initialState: types.ICollectionInstallState = {
  activeSession: undefined,
  lastActiveSessionId: undefined,
  sessionHistory: {},
};

// Statuses considered "at least downloaded" for the downloadedCount counter
const DOWNLOADED_STATUSES = new Set([
  "downloaded",
  "downloading",
  "installed",
  "installing",
  "skipped",
]);

/**
 * Adjust aggregate session counters incrementally based on a status transition.
 * O(1) instead of O(n) — avoids re-iterating every mod on every status update.
 */
function adjustCounters(
  session: types.ICollectionInstallSession,
  oldStatus: string | undefined,
  newStatus: string,
): {
  downloadedCount: number;
  installedCount: number;
  failedCount: number;
  skippedCount: number;
} {
  let { downloadedCount, installedCount, failedCount, skippedCount } = session;

  // downloadedCount tracks mods in any "active" (non-pending, non-failed) state
  if (!DOWNLOADED_STATUSES.has(oldStatus) && DOWNLOADED_STATUSES.has(newStatus))
    downloadedCount++;
  if (DOWNLOADED_STATUSES.has(oldStatus) && !DOWNLOADED_STATUSES.has(newStatus))
    downloadedCount--;

  // installedCount
  if (oldStatus !== "installed" && newStatus === "installed") installedCount++;
  if (oldStatus === "installed" && newStatus !== "installed") installedCount--;

  // failedCount
  if (oldStatus !== "failed" && newStatus === "failed") failedCount++;
  if (oldStatus === "failed" && newStatus !== "failed") failedCount--;

  // skippedCount
  if (oldStatus !== "skipped" && newStatus === "skipped") skippedCount++;
  if (oldStatus === "skipped" && newStatus !== "skipped") skippedCount--;

  return { downloadedCount, installedCount, failedCount, skippedCount };
}

const collectionInstallReducer = {
  reducers: {
    [actions.startInstallSession as any]: (
      state: types.ICollectionInstallState,
      payload: any,
    ) => {
      const sessionId = util.generateCollectionSessionId(
        payload.collectionId,
        payload.profileId,
      );
      const mods = payload.mods as { [ruleId: string]: any };
      // Full iteration is fine here — this runs once per session start
      const downloadedCount = Object.values(mods).filter((mod) =>
        DOWNLOADED_STATUSES.has(mod.status),
      ).length;
      const installedCount = Object.values(mods).filter(
        (mod) => mod.status === "installed",
      ).length;
      const session: types.ICollectionInstallSession = {
        ...payload,
        sessionId,
        downloadedCount,
        installedCount,
        failedCount: 0,
        skippedCount: 0,
      };

      return util.setSafe(state, ["activeSession"], session);
    },

    [actions.updateModStatus as any]: (
      state: types.ICollectionInstallState,
      payload: any,
    ) => {
      if (
        !state.activeSession ||
        state.activeSession.sessionId !== payload.sessionId
      ) {
        return state;
      }

      const oldStatus = state.activeSession.mods?.[payload.ruleId]?.status;
      const modPath = ["activeSession", "mods", payload.ruleId];
      let newState = util.setSafe(
        state,
        [...modPath, "status"],
        payload.status,
      );

      // Incremental counter update — O(1) instead of iterating all mods
      const counters = adjustCounters(
        state.activeSession,
        oldStatus,
        payload.status,
      );
      newState = util.merge(newState, ["activeSession"], counters);

      return newState;
    },

    [actions.markModInstalled as any]: (
      state: types.ICollectionInstallState,
      payload: any,
    ) => {
      if (
        !state.activeSession ||
        state.activeSession.sessionId !== payload.sessionId
      ) {
        return state;
      }

      const oldStatus = state.activeSession.mods?.[payload.ruleId]?.status;

      let newState = util.setSafe(
        state,
        ["activeSession", "mods", payload.ruleId, "modId"],
        payload.modId,
      );
      newState = util.setSafe(
        newState,
        ["activeSession", "mods", payload.ruleId, "status"],
        "installed",
      );
      newState = util.setSafe(
        newState,
        ["activeSession", "mods", payload.ruleId, "endTime"],
        Date.now(),
      );

      // Incremental counter update
      const counters = adjustCounters(
        state.activeSession,
        oldStatus,
        "installed",
      );
      newState = util.setSafe(
        newState,
        ["activeSession", "downloadedCount"],
        counters.downloadedCount,
      );
      newState = util.setSafe(
        newState,
        ["activeSession", "installedCount"],
        counters.installedCount,
      );

      return newState;
    },

    [actions.finishInstallSession as any]: (
      state: types.ICollectionInstallState,
      payload: any,
    ) => {
      if (
        !state.activeSession ||
        state.activeSession.sessionId !== payload.sessionId
      ) {
        return state;
      }

      let newState = util.setSafe(
        state,
        ["sessionHistory", payload.sessionId],
        state.activeSession,
      );
      newState = util.setSafe(
        newState,
        ["lastActiveSessionId"],
        payload.sessionId,
      );
      newState = util.setSafe(newState, ["activeSession"], undefined);

      return newState;
    },
  },

  defaults: initialState,
};

export default collectionInstallReducer;
