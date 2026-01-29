import * as _ from "lodash";
import { types, util } from "vortex-api";

import * as actions from "./actions";

export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setModTypeConflictsSetting as any]: (state, payload) => {
      const { enabled } = payload;
      return util.setSafe(state, ["modTypeConflictsEnabled"], enabled);
    },
  },
  defaults: {
    modTypeConflictsEnabled: true,
  },
};

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setSource as any]: (state, payload) => {
      if (
        _.isEqual(
          payload,
          util.getSafe(state, ["connection", "source"], undefined),
        )
      ) {
        // unchanged
        return state;
      }

      if (payload.pos !== undefined) {
        return util.setSafe(state, ["connection", "source"], payload);
      } else if (
        payload.id ===
        util.getSafe(state, ["connection", "source", "id"], undefined)
      ) {
        return util.setSafe(state, ["connection", "source"], undefined);
      } else {
        return state;
      }
    },
    [actions.setTarget as any]: (state, payload) => {
      if (
        payload.pos !== undefined &&
        (payload.id !== null ||
          state.connection === undefined ||
          state.connection.target === undefined ||
          state.connection.target.id === undefined ||
          state.connection.target.id === null)
      ) {
        return util.setSafe(state, ["connection", "target"], payload);
      } else if (
        payload.id ===
        util.getSafe(state, ["connection", "target", "id"], undefined)
      ) {
        return util.setSafe(state, ["connection", "target"], undefined);
      } else {
        return state;
      }
    },
    [actions.setCreateRule as any]: (state, payload) =>
      util.setSafe(state, ["dialog"], payload),
    [actions.closeDialog as any]: (state) =>
      util.setSafe(state, ["dialog"], undefined),
    [actions.setType as any]: (state, payload) =>
      util.setSafe(state, ["dialog", "type"], payload),
    [actions.setConflictInfo as any]: (state, payload) =>
      util.setSafe(state, ["conflicts"], payload),
    [actions.setConflictDialog as any]: (state, payload) =>
      util.setSafe(state, ["conflictDialog"], payload),
    [actions.setFileOverrideDialog as any]: (state, payload) =>
      util.setSafe(state, ["overrideDialog"], payload),
    [actions.highlightConflictIcon as any]: (state, payload) =>
      util.setSafe(state, ["highlightConflicts"], payload),
    [actions.setEditCycle as any]: (state, payload) =>
      util.setSafe(state, ["editCycle"], payload),
    [actions.setHasUnsolvedConflicts as any]: (state, payload) =>
      util.setSafe(
        state,
        ["hasUnsolvedConflicts"],
        payload.hasUnsolvedConflicts,
      ),
  },
  defaults: {
    connection: undefined,
    dialog: undefined,
    highlightConflicts: false,
    conflicts: undefined,
    conflictDialog: undefined,
    overrideDialog: undefined,
    editCycle: undefined,
    hasUnsolvedConflicts: false,
  },
};
