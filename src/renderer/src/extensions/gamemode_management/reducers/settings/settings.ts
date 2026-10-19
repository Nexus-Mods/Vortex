import * as _ from "lodash";

import { actionsToReducerSpec } from "@/reducers/builder";
import type { IDiscoveredTool } from "@/types/IDiscoveredTool";
import type { ISettingsGameMode } from "@/types/IState";

import * as actions from "../../actions/settings";
import type { IDiscoveryResult } from "../../types/IDiscoveryResult";

const defaultState: ISettingsGameMode = {
  discovered: {},
  searchPaths: [],
  pickerLayout: "small",
  sortManaged: "alphabetical",
  sortUnmanaged: "alphabetical",
  sortDetected: "recentlydetected",
};

/**
 * reducer for changes to the discovered games
 */
export const settingsReducer = actionsToReducerSpec(defaultState, actions, {
  addDiscoveredGame: (state, payload) => {
    const { id } = payload;
    const old = state.discovered[id];
    let result = payload.result;
    // don't replace previously discovered games as the settings
    // there may also be user configuration
    // If the path was manually set by the user, don't let auto-discovery overwrite it
    if (old?.pathSetManually && !result.pathSetManually) {
      const { path: _path, ...rest } = result;
      result = rest;
    }
    let merged: IDiscoveryResult = { ...old, ...result };
    if (merged.executable === undefined) {
      // work around a problem where a value of undefined will be picked up as a
      // difference to the value not being set at all which triggered a change to be detected
      // every startup
      const { executable: _executable, ...rest } = merged;
      merged = rest;
    }
    if (result.path !== undefined && result.store === undefined) {
      // new path set but no store? fall back to default
      merged = { ...merged, store: undefined };
    }

    // Stamp when the game turned up, but only the first time a path appears or when it
    // moves. Discovery re-reports every installed game on every run, so stamping
    // unconditionally would make them all look freshly found after any rescan.
    if (result.path !== undefined && result.path !== old?.path) {
      merged = { ...merged, timestamp: Date.now() };
    }

    // avoid triggering unnecessary events
    return _.isEqual(merged, old)
      ? state
      : { ...state, discovered: { ...state.discovered, [id]: merged } };
  },
  clearDiscoveredGame: (state, payload) => {
    const { id } = payload;
    const game = state.discovered[id];
    if (game === undefined) {
      return state;
    }
    // if the path was set manually, reset that as well
    const { pathSetManually: _pathSetManually, path: _path, ...rest } = game;
    return _.isEqual(rest, game)
      ? state
      : { ...state, discovered: { ...state.discovered, [id]: rest } };
  },
  setGamePath: (state, payload) => {
    const input: IDiscoveryResult = {
      path: payload.gamePath,
      pathSetManually: payload.gamePath !== undefined,
      store: payload.store,
      // always include executable so that switching stores clears a stale
      // custom executable (e.g. gamepass.exe -> default game.exe)
      executable: payload.exePath,
    };
    const old = state.discovered[payload.gameId];
    let merged: IDiscoveryResult = { ...old, ...input };
    if (merged.executable === undefined) {
      const { executable: _executable, ...rest } = merged;
      merged = rest;
    }
    return {
      ...state,
      discovered: { ...state.discovered, [payload.gameId]: merged },
    };
  },
  addDiscoveredTool: (state, payload) => {
    if (state.discovered[payload.gameId] === undefined) {
      return state;
    }

    const old = _.omit(state.discovered[payload.gameId].tools?.[payload.toolId] ?? {}, [
      "timestamp",
    ]) as IDiscoveredTool;
    if (!payload.manual && _.isEqual(old, payload.result)) {
      return state;
    }

    return {
      ...state,
      discovered: {
        ...state.discovered,
        [payload.gameId]: {
          ...state.discovered[payload.gameId],
          tools: {
            ...state.discovered[payload.gameId].tools,
            [payload.toolId]: {
              ...payload.result,
              hidden: old.hidden,
              timestamp: Date.now(),
            },
          },
        },
      },
    };
  },
  setToolVisible: (state, payload) => {
    // custom added tools can be deleted so we do that instead of hiding them
    if (!payload.visible && state.discovered[payload.gameId]?.tools?.[payload.toolId]?.custom) {
      const game = state.discovered[payload.gameId];
      const { [payload.toolId]: _tool, ...tools } = game.tools;
      return {
        ...state,
        discovered: { ...state.discovered, [payload.gameId]: { ...game, tools } },
      };
    } else {
      return {
        ...state,
        discovered: {
          ...state.discovered,
          [payload.gameId]: {
            ...state.discovered[payload.gameId],
            tools: {
              ...state.discovered[payload.gameId]?.tools,
              [payload.toolId]: {
                ...state.discovered[payload.gameId]?.tools?.[payload.toolId],
                hidden: !payload.visible,
              },
            },
          },
        },
      };
    }
  },
  setGameParameters: (state, payload) =>
    state.discovered[payload.gameId] === undefined
      ? state
      : {
          ...state,
          discovered: {
            ...state.discovered,
            [payload.gameId]: {
              ...state.discovered[payload.gameId],
              ...payload.parameters,
            },
          },
        },
  setGameHidden: (state, payload) => ({
    ...state,
    discovered: {
      ...state.discovered,
      [payload.gameId]: { ...state.discovered[payload.gameId], hidden: payload.hidden },
    },
  }),
  setGameSearchPaths: (state, payload) => ({ ...state, searchPaths: payload }),
  setPickerLayout: (state, payload) => ({ ...state, pickerLayout: payload.layout }),
  setSortManaged: (state, payload) => ({ ...state, sortManaged: payload }),
  setSortUnmanaged: (state, payload) => ({ ...state, sortUnmanaged: payload }),
  setSortDetected: (state, payload) => ({ ...state, sortDetected: payload }),
});
