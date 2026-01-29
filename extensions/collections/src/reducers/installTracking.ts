import { types, util } from "vortex-api";
import * as actions from "../actions/installTracking";

// Initial state
const initialState: types.ICollectionInstallState = {
  activeSession: undefined,
  lastActiveSessionId: undefined,
  sessionHistory: {},
};

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
      const downloadedCount = Object.values(mods).filter((mod) =>
        [
          "downloaded",
          "downloading",
          "installed",
          "installing",
          "skipped",
        ].includes(mod.status),
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

      const modPath = ["activeSession", "mods", payload.ruleId];
      let newState = util.setSafe(
        state,
        [...modPath, "status"],
        payload.status,
      );

      // Update session counters
      const mods = newState.activeSession!.mods;
      const downloadedCount = Object.values(mods).filter((mod) =>
        [
          "downloaded",
          "downloading",
          "installed",
          "installing",
          "skipped",
        ].includes(mod.status),
      ).length;
      const installedCount = Object.values(mods).filter(
        (mod) => mod.status === "installed",
      ).length;
      const failedCount = Object.values(mods).filter(
        (mod) => mod.status === "failed",
      ).length;
      const skippedCount = Object.values(mods).filter(
        (mod) => mod.status === "skipped",
      ).length;

      newState = util.merge(newState, ["activeSession"], {
        downloadedCount,
        installedCount,
        failedCount,
        skippedCount,
      });

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

      // Update counters
      const mods = newState.activeSession!.mods;
      const downloadedCount = Object.values(mods).filter((mod) =>
        [
          "downloaded",
          "downloading",
          "installed",
          "installing",
          "skipped",
        ].includes(mod.status),
      ).length;
      const installedCount = Object.values(mods).filter(
        (mod) => mod.status === "installed",
      ).length;
      newState = util.setSafe(
        newState,
        ["activeSession", "downloadedCount"],
        downloadedCount,
      );
      newState = util.setSafe(
        newState,
        ["activeSession", "installedCount"],
        installedCount,
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
