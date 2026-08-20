import {
  finishInstallSession,
  markModInstalled,
  markSessionStalled,
  startInstallSession,
  updateModStatus,
} from "../actions/collectionInstallTracking";
import { log } from "../logging";
import type * as types from "../types/api";
import { generateCollectionSessionId } from "../util/collectionInstallSession";
import { actionsToReducerSpec } from "./builder";

const actions = {
  startInstallSession,
  updateModStatus,
  markModInstalled,
  finishInstallSession,
  markSessionStalled,
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

/**
 * Whether the session tracks this rule id. A write for an id it does not track identifies no
 * member, so applying it would invent an entry with no rule and count it towards the totals the
 * completion check and the progress bars read.
 */
function isTrackedRule(session: types.ICollectionInstallSession, ruleId: string): boolean {
  if (session.mods[ruleId] !== undefined) {
    return true;
  }
  log("warn", "collection session write for an untracked rule", {
    sessionId: session.sessionId,
    ruleId,
  });
  return false;
}

const defaultState: types.ICollectionInstallState = {
  activeSession: undefined,
  lastActiveSessionId: undefined,
  sessionHistory: {},
};

const collectionInstallReducer = actionsToReducerSpec(defaultState, actions, {
  startInstallSession: (state, payload) => {
    const sessionId = generateCollectionSessionId(payload.collectionId, payload.profileId);
    const mods = payload.mods;
    // Full iteration is fine here — this runs once per session start
    const downloadedCount = Object.values(mods).filter((mod) =>
      DOWNLOADED_STATUSES.has(mod.status),
    ).length;
    const installedCount = Object.values(mods).filter((mod) => mod.status === "installed").length;
    // members seeded terminal (a resumed install, or an optional skipped in an earlier one) count
    // from the start, otherwise moving one off that status takes its total below zero
    const failedCount = Object.values(mods).filter((mod) => mod.status === "failed").length;
    const ignoredCount = Object.values(mods).filter((mod) => mod.status === "ignored").length;
    const session: types.ICollectionInstallSession = {
      ...payload,
      sessionId,
      downloadedCount,
      installedCount,
      failedCount,
      ignoredCount,
    };

    return { ...state, activeSession: session };
  },

  updateModStatus: (state, payload) => {
    if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
      return state;
    }
    if (!isTrackedRule(state.activeSession, payload.ruleId)) {
      return state;
    }

    const { mods, ...activeSession } = state.activeSession;
    const oldStatus = mods[payload.ruleId]?.status;
    const counters = adjustCounters(state.activeSession, oldStatus, payload.status);

    return {
      ...state,
      activeSession: {
        ...activeSession,
        ...counters,
        mods: {
          ...mods,
          [payload.ruleId]: { ...mods[payload.ruleId], status: payload.status },
        },
      },
    };
  },

  markModInstalled: (state, payload) => {
    if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
      return state;
    }
    if (!isTrackedRule(state.activeSession, payload.ruleId)) {
      return state;
    }

    const { mods, ...activeSession } = state.activeSession;
    const oldStatus = mods[payload.ruleId]?.status;

    // Merge ALL counters: a retry can revert failed -> installed (planSessionWrite allows it), and
    // that transition must decrement failedCount, not just bump installedCount.
    const counters = adjustCounters(state.activeSession, oldStatus, "installed");

    return {
      ...state,
      activeSession: {
        ...activeSession,
        ...counters,
        mods: {
          ...mods,
          [payload.ruleId]: {
            ...mods[payload.ruleId],
            modId: payload.modId,
            status: "installed",
            endTime: Date.now(),
          },
        },
      },
    };
  },

  finishInstallSession: (state, payload) => {
    if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
      return state;
    }

    return {
      ...state,
      sessionHistory: { ...state.sessionHistory, [payload.sessionId]: state.activeSession },
      lastActiveSessionId: payload.sessionId,
      activeSession: undefined,
    };
  },

  markSessionStalled: (state, payload) => {
    if (!state.activeSession || state.activeSession.sessionId !== payload.sessionId) {
      return state;
    }
    return { ...state, activeSession: { ...state.activeSession, stalled: payload.stalled } };
  },
});

export default collectionInstallReducer;
