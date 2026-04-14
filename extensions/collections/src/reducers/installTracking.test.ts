import { describe, expect, it } from "vitest";

// The reducer file exports a default object with { reducers, defaults }.
// We also need the action creators so we can get their .toString() keys.
import reducer from "./installTracking";
import * as actions from "../actions/installTracking";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand: run a reducer action on a state. */
function reduce(state: any, actionCreator: any, payload: any) {
  const key = actionCreator.toString();
  const fn = reducer.reducers[key];
  if (!fn) {
    throw new Error(`No reducer registered for action "${key}"`);
  }
  return fn(state, payload);
}

function makeSession(overrides: Partial<any> = {}): any {
  return {
    sessionId: "col1_prof1",
    collectionId: "col1",
    profileId: "prof1",
    gameId: "skyrimse",
    totalRequired: 3,
    totalOptional: 1,
    downloadedCount: 0,
    installedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    mods: {},
    ...overrides,
  };
}

function makeState(overrides: Partial<any> = {}): any {
  return {
    activeSession: undefined,
    lastActiveSessionId: undefined,
    sessionHistory: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// adjustCounters — tested indirectly via updateModStatus reducer
// ---------------------------------------------------------------------------

describe("installTracking reducer", () => {
  describe("startInstallSession", () => {
    it("creates a new active session with computed counters", () => {
      const state = makeState();
      const payload = {
        collectionId: "col1",
        profileId: "prof1",
        gameId: "skyrimse",
        totalRequired: 3,
        totalOptional: 1,
        mods: {
          rule1: { status: "pending", type: "requires", rule: {} },
          rule2: { status: "downloaded", type: "requires", rule: {} },
          rule3: { status: "installed", type: "requires", rule: {} },
        },
      };

      const result = reduce(state, actions.startInstallSession, payload);

      expect(result.activeSession).toBeDefined();
      expect(result.activeSession.sessionId).toBe("col1_prof1");
      // "downloaded" and "installed" both count as downloaded
      expect(result.activeSession.downloadedCount).toBe(2);
      expect(result.activeSession.installedCount).toBe(1);
    });

    it("computes zero counters for an empty mods object", () => {
      const state = makeState();
      const payload = {
        collectionId: "col1",
        profileId: "prof1",
        gameId: "skyrimse",
        totalRequired: 0,
        totalOptional: 0,
        mods: {},
      };

      const result = reduce(state, actions.startInstallSession, payload);
      expect(result.activeSession.downloadedCount).toBe(0);
      expect(result.activeSession.installedCount).toBe(0);
    });
  });

  describe("updateModStatus (adjustCounters)", () => {
    it("increments downloadedCount when transitioning from pending to downloading", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "pending", type: "requires", rule: {} },
        },
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "downloading",
      });

      expect(result.activeSession.downloadedCount).toBe(1);
    });

    it("increments installedCount when transitioning to installed", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "downloading", type: "requires", rule: {} },
        },
        downloadedCount: 1,
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "installed",
      });

      expect(result.activeSession.installedCount).toBe(1);
      // downloading → installed: both are "downloaded" statuses, so no change
      expect(result.activeSession.downloadedCount).toBe(1);
    });

    it("increments failedCount when transitioning to failed", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "pending", type: "requires", rule: {} },
        },
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "failed",
      });

      expect(result.activeSession.failedCount).toBe(1);
      // pending → failed: neither is a "downloaded" status, so count stays 0
      expect(result.activeSession.downloadedCount).toBe(0);
    });

    it("increments skippedCount when transitioning to skipped", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "pending", type: "recommends", rule: {} },
        },
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "skipped",
      });

      expect(result.activeSession.skippedCount).toBe(1);
      // pending → skipped: skipped IS a downloaded status
      expect(result.activeSession.downloadedCount).toBe(1);
    });

    it("decrements failedCount when recovering from failed to downloading", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "failed", type: "requires", rule: {} },
        },
        failedCount: 1,
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "downloading",
      });

      expect(result.activeSession.failedCount).toBe(0);
      expect(result.activeSession.downloadedCount).toBe(1);
    });

    it("handles the full lifecycle: pending → downloading → installed", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "pending", type: "requires", rule: {} },
        },
      });
      let state = makeState({ activeSession: session });

      // pending → downloading
      state = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "downloading",
      });
      expect(state.activeSession.downloadedCount).toBe(1);
      expect(state.activeSession.installedCount).toBe(0);

      // downloading → installing
      state = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "installing",
      });
      expect(state.activeSession.downloadedCount).toBe(1);
      expect(state.activeSession.installedCount).toBe(0);

      // installing → installed
      state = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "installed",
      });
      expect(state.activeSession.downloadedCount).toBe(1);
      expect(state.activeSession.installedCount).toBe(1);
    });

    it("is a no-op when sessionId does not match", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "pending", type: "requires", rule: {} },
        },
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.updateModStatus, {
        sessionId: "wrong_session",
        ruleId: "rule1",
        status: "downloading",
      });

      expect(result).toBe(state);
    });

    it("is a no-op when there is no active session", () => {
      const state = makeState();

      const result = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "downloading",
      });

      expect(result).toBe(state);
    });

    it("correctly handles installed → failed (regression: both counters update)", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "installed", type: "requires", rule: {} },
        },
        downloadedCount: 1,
        installedCount: 1,
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.updateModStatus, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        status: "failed",
      });

      expect(result.activeSession.installedCount).toBe(0);
      expect(result.activeSession.failedCount).toBe(1);
      // installed is a "downloaded" status, failed is not
      expect(result.activeSession.downloadedCount).toBe(0);
    });
  });

  describe("markModInstalled", () => {
    it("sets modId, status=installed, endTime and updates counters", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "downloading", type: "requires", rule: {} },
        },
        downloadedCount: 1,
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.markModInstalled, {
        sessionId: "col1_prof1",
        ruleId: "rule1",
        modId: "actual-mod-id",
      });

      expect(result.activeSession.mods.rule1.modId).toBe("actual-mod-id");
      expect(result.activeSession.mods.rule1.status).toBe("installed");
      expect(result.activeSession.mods.rule1.endTime).toBeTypeOf("number");
      expect(result.activeSession.installedCount).toBe(1);
    });

    it("is a no-op when sessionId does not match", () => {
      const session = makeSession({
        mods: {
          rule1: { status: "downloading", type: "requires", rule: {} },
        },
      });
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.markModInstalled, {
        sessionId: "wrong",
        ruleId: "rule1",
        modId: "m1",
      });

      expect(result).toBe(state);
    });
  });

  describe("finishInstallSession", () => {
    it("moves active session to history and clears it", () => {
      const session = makeSession();
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.finishInstallSession, {
        sessionId: "col1_prof1",
        success: true,
      });

      expect(result.activeSession).toBeUndefined();
      expect(result.lastActiveSessionId).toBe("col1_prof1");
      expect(result.sessionHistory["col1_prof1"]).toEqual(session);
    });

    it("is a no-op when sessionId does not match", () => {
      const session = makeSession();
      const state = makeState({ activeSession: session });

      const result = reduce(state, actions.finishInstallSession, {
        sessionId: "wrong",
        success: true,
      });

      expect(result).toBe(state);
    });
  });

  describe("defaults", () => {
    it("provides a valid initial state", () => {
      expect(reducer.defaults).toEqual({
        activeSession: undefined,
        lastActiveSessionId: undefined,
        sessionHistory: {},
      });
    });
  });
});
