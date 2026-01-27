import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe, deleteOrNop } from "../../../util/storeHelper";

import * as actions from "../actions/persistent";

export interface IHealthCheckPersistentState {
  /**
   * Map of mod nexusModId to array of hidden requirement IDs (from Nexus API)
   * Uses requirement.id instead of requirement.modId to properly support external requirements
   * Example: { 95885: ["req-id-1", "req-id-2", "req-id-3"] }
   * This means mod 95885 has requirements with IDs "req-id-1", "req-id-2", and "req-id-3" hidden
   */
  hiddenRequirements: { [modId: number]: string[] };
}

/**
 * Reducer for health check persistent state
 */
export const persistentReducer: IReducerSpec<IHealthCheckPersistentState> = {
  reducers: {
    [actions.setRequirementHidden as any]: (state, payload) => {
      const { modId, requirementId, hidden } = payload;
      const currentHidden = state.hiddenRequirements?.[modId] || [];

      if (hidden && !currentHidden.includes(requirementId)) {
        return setSafe(
          state,
          ["hiddenRequirements", modId],
          [...currentHidden, requirementId],
        );
      } else if (!hidden && currentHidden.includes(requirementId)) {
        const filtered = currentHidden.filter((id) => id !== requirementId);
        if (filtered.length === 0) {
          // Remove the mod entry entirely if no more hidden requirements
          return deleteOrNop(state, ["hiddenRequirements", modId]);
        }
        return setSafe(state, ["hiddenRequirements", modId], filtered);
      }
      return state;
    },
    [actions.setAllModRequirementsHidden as any]: (state, payload) => {
      const { modId, requirementIds } = payload;
      if (requirementIds.length === 0) {
        return deleteOrNop(state, ["hiddenRequirements", modId]);
      }
      return setSafe(state, ["hiddenRequirements", modId], requirementIds);
    },
    [actions.clearAllHiddenRequirements as any]: (state) => {
      return setSafe(state, ["hiddenRequirements"], {});
    },
  },
  defaults: {
    hiddenRequirements: {},
  },
};
