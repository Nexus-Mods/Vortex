import * as actions from "../actions/collectionInstallTracking";
import type * as types from "../types/api";
import { generateCollectionSessionId } from "../util/collectionInstallSession";
import { merge, setSafe } from "../util/storeHelper";

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
  "ignored",
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
  ignoredCount: number;
} {
  let { downloadedCount, installedCount, failedCount, ignoredCount } = session;

  // downloadedCount tracks mods in any "active" (non-pending, non-failed) state
  if (!DOWNLOADED_STATUSES.has(oldStatus) && DOWNLOADED_STATUSES.has(newStatus)) downloadedCount++;
  if (DOWNLOADED_STATUSES.has(oldStatus) && !DOWNLOADED_STATUSES.has(newStatus)) downloadedCount--;

  // installedCount
  if (oldStatus !== "installed" && newStatus === "installed") installedCount++;
  if (oldStatus === "installed" && newStatus !== "installed") installedCount--;

  // failedCount
  if (oldStatus !== "failed" && newStatus === "failed") failedCount++;
  if (oldStatus === "failed" && newStatus !== "failed") failedCount--;

  // ignoredCount
  if (oldStatus !== "ignored" && newStatus === "ignored") ignoredCount++;
  if (oldStatus === "ignored" && newStatus !== "ignored") ignoredCount--;

  return { downloadedCount, installedCount, failedCount, ignoredCount };
}

const collectionInstallReducer = {
  reducers: {
    [actions.startInstallSession as any]: (state: types.ICollectionInstallState, payload: any) => {
      const sessionId = generateCollectionSessionId(payload.collectionId, payload.profileId);
      const mods = payload.mods as { [ruleId: string]: any };
      // Full iteration is fine here — this runs once per session start
      const downloadedCount = Object.values(mods).filter((mod) =>
        DOWNLOADED_STATUSES.has(mod.status),
      ).length;
      const installedCount = Object.values(mods).filter((mod) => mod.status === "installed").length;
      const session: types.ICollectionInstallSession = {
        ...payload,
        sessionId,
        downloadedCount,
        installedCount,
        failedCount: 0,
        ignoredCount: 0,
      };

      return setSafe(state, ["activeSession"], session);
    },

    [actions.updateModStatus as any]: (state: types.ICollectionInstallState, payload: any) => {
      if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
        return state;
      }

      const oldStatus = state.activeSession.mods?.[payload.ruleId]?.status;
      const modPath = ["activeSession", "mods", payload.ruleId];
      let newState = setSafe(state, [...modPath, "status"], payload.status);

      // Incremental counter update — O(1) instead of iterating all mods
      const counters = adjustCounters(state.activeSession, oldStatus, payload.status);
      newState = merge(newState, ["activeSession"], counters);

      return newState;
    },

    [actions.markModInstalled as any]: (state: types.ICollectionInstallState, payload: any) => {
      if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
        return state;
      }

      const oldStatus = state.activeSession.mods?.[payload.ruleId]?.status;

      let newState = setSafe(
        state,
        ["activeSession", "mods", payload.ruleId, "modId"],
        payload.modId,
      );
      newState = setSafe(
        newState,
        ["activeSession", "mods", payload.ruleId, "status"],
        "installed",
      );
      newState = setSafe(
        newState,
        ["activeSession", "mods", payload.ruleId, "endTime"],
        Date.now(),
      );

      // Incremental counter update. Merge ALL counters: a retry can revert failed ->
      // installed (planSessionWrite allows it), and that transition must decrement
      // failedCount, not just bump installedCount.
      const counters = adjustCounters(state.activeSession, oldStatus, "installed");
      newState = merge(newState, ["activeSession"], counters);

      return newState;
    },

    [actions.finishInstallSession as any]: (state: types.ICollectionInstallState, payload: any) => {
      if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
        return state;
      }

      let newState = setSafe(state, ["sessionHistory", payload.sessionId], state.activeSession);
      newState = setSafe(newState, ["lastActiveSessionId"], payload.sessionId);
      newState = setSafe(newState, ["activeSession"], undefined);

      return newState;
    },
  },

  defaults: initialState,
};

export default collectionInstallReducer;
