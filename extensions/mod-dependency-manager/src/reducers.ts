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

export const settingsReducer: types.IPartialReducerSpec<types.ISettingsWorkarounds> = {
  reducers: {
    [actions.setModTypeConflictsSetting as any]: (
      state: types.ISettingsWorkarounds,
      payload: { enabled: boolean },
    ) => {
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
export const sessionReducer: types.IReducerSpec<IDependenciesSessionState> = {
  reducers: {
    [actions.setSource as any]: (state: IDependenciesSessionState, payload: IConnectionEnd) => {
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
    [actions.setTarget as any]: (state: IDependenciesSessionState, payload: IConnectionEnd) => {
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
    [actions.setCreateRule as any]: (state: IDependenciesSessionState, payload: IRuleDialog) =>
      util.setSafe(state, ["dialog"], payload),
    [actions.closeDialog as any]: (state: IDependenciesSessionState) =>
      util.setSafe(state, ["dialog"], undefined),
    [actions.setType as any]: (state: IDependenciesSessionState, payload: RuleType) =>
      util.setSafe(state, ["dialog", "type"], payload),
    [actions.setConflictInfo as any]: (
      state: IDependenciesSessionState,
      payload: { [modId: string]: IConflict[] },
    ) => util.setSafe(state, ["conflicts"], payload),
    [actions.setConflictDialog as any]: (
      state: IDependenciesSessionState,
      payload: IConflictDialog,
    ) => util.setSafe(state, ["conflictDialog"], payload),
    [actions.setFileOverrideDialog as any]: (
      state: IDependenciesSessionState,
      payload: IOverrideDialog,
    ) => util.setSafe(state, ["overrideDialog"], payload),
    [actions.highlightConflictIcon as any]: (state: IDependenciesSessionState, payload: boolean) =>
      util.setSafe(state, ["highlightConflicts"], payload),
    [actions.setEditCycle as any]: (state: IDependenciesSessionState, payload: IEditCycle) =>
      util.setSafe(state, ["editCycle"], payload),
    // The count is what the mods toolbar says in the Manage Rules tooltip; the boolean
    // stays derived from it for what already reads that.
    [actions.setUnsolvedConflictsCount as any]: (
      state: IDependenciesSessionState,
      payload: { count: number },
    ): IDependenciesSessionState => ({
      ...state,
      unsolvedConflictsCount: payload.count,
      hasUnsolvedConflicts: payload.count > 0,
    }),
  },
  defaults: {
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
};
