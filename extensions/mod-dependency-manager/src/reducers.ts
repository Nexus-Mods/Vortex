import { types, util } from "@nexusmods/vortex-api";
import * as _ from "lodash";
import type { RuleType } from "modmeta-db";

import * as actions from "./actions";
import type { IConflict } from "./types/IConflict";
import type {
  IConflictDialog,
  IConnectionEnd,
  IDependenciesSessionState,
  IEditCycle,
  IOverrideDialog,
  IRuleDialog,
} from "./types/IDependenciesState";

const settingsActions = { setModTypeConflictsSetting: actions.setModTypeConflictsSetting };

export const settingsReducer = util.actionsToPartialReducerSpec<
  types.ISettingsWorkarounds,
  typeof settingsActions
>({ modTypeConflictsEnabled: true }, settingsActions, {
  setModTypeConflictsSetting: (state, payload) => {
    const { enabled } = payload;
    return util.setSafe(state, ["modTypeConflictsEnabled"], enabled);
  },
});

const sessionActions = {
  setSource: actions.setSource,
  setTarget: actions.setTarget,
  setCreateRule: actions.setCreateRule,
  closeDialog: actions.closeDialog,
  setType: actions.setType,
  setConflictInfo: actions.setConflictInfo,
  setConflictDialog: actions.setConflictDialog,
  setFileOverrideDialog: actions.setFileOverrideDialog,
  highlightConflictIcon: actions.highlightConflictIcon,
  setEditCycle: actions.setEditCycle,
  setUnsolvedConflictsCount: actions.setUnsolvedConflictsCount,
};

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer = util.actionsToReducerSpec<
  IDependenciesSessionState,
  typeof sessionActions
>(
  {
    connection: undefined,
    dialog: undefined,
    highlightConflicts: false,
    conflicts: undefined,
    conflictDialog: undefined,
    overrideDialog: undefined,
    editCycle: undefined,
    unsolvedConflictsCount: 0,
    hasUnsolvedConflicts: false,
  },
  sessionActions,
  {
    setSource: (state, payload) => {
      if (_.isEqual(payload, util.getSafe(state, ["connection", "source"], undefined))) {
        // unchanged
        return state;
      }

      if (payload.pos !== undefined) {
        return util.setSafe(state, ["connection", "source"], payload);
      } else if (payload.id === util.getSafe(state, ["connection", "source", "id"], undefined)) {
        return util.setSafe(state, ["connection", "source"], undefined);
      } else {
        return state;
      }
    },
    setTarget: (state, payload) => {
      if (
        payload.pos !== undefined &&
        (payload.id !== null ||
          state.connection === undefined ||
          state.connection.target === undefined ||
          state.connection.target.id === undefined ||
          state.connection.target.id === null)
      ) {
        return util.setSafe(state, ["connection", "target"], payload);
      } else if (payload.id === util.getSafe(state, ["connection", "target", "id"], undefined)) {
        return util.setSafe(state, ["connection", "target"], undefined);
      } else {
        return state;
      }
    },
    setCreateRule: (state, payload) => util.setSafe(state, ["dialog"], payload),
    closeDialog: (state) => util.setSafe(state, ["dialog"], undefined),
    setType: (state, payload) => util.setSafe(state, ["dialog", "type"], payload),
    setConflictInfo: (state, payload) => util.setSafe(state, ["conflicts"], payload),
    setConflictDialog: (state, payload) => util.setSafe(state, ["conflictDialog"], payload),
    setFileOverrideDialog: (state, payload) => util.setSafe(state, ["overrideDialog"], payload),
    highlightConflictIcon: (state, payload) => util.setSafe(state, ["highlightConflicts"], payload),
    setEditCycle: (state, payload) => util.setSafe(state, ["editCycle"], payload),
    // The count is what the mods toolbar says in the Manage Rules tooltip; the boolean
    // stays derived from it for what already reads that.
    setUnsolvedConflictsCount: (state, payload) => ({
      ...state,
      unsolvedConflictsCount: payload.count,
      hasUnsolvedConflicts: payload.count > 0,
    }),
  },
);
