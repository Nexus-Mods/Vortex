import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe, deleteOrNop } from "../../../util/storeHelper";

import * as actions from "../actions/persistent";

export interface IHealthCheckPersistentState {
  /**
   * Map of mod nexusModId to array of hidden requirement nexusModIds
   * Example: { 95885: [95142, 83937, 93634] }
   * This means mod 95885 has requirements 95142, 83937, and 93634 hidden
   */
  hiddenRequirements: { [modId: number]: number[] };
}

/**
 * Reducer for health check persistent state
 */
export const persistentReducer: IReducerSpec<IHealthCheckPersistentState> = {
  reducers: {
    [actions.setRequirementHidden as any]: (state, payload) => {
      const { modId, requirementModId, hidden } = payload;
      const currentHidden = state.hiddenRequirements?.[modId] || [];

      if (hidden && !currentHidden.includes(requirementModId)) {
        return setSafe(
          state,
          ["hiddenRequirements", modId],
          [...currentHidden, requirementModId],
        );
      } else if (!hidden && currentHidden.includes(requirementModId)) {
        const filtered = currentHidden.filter((id) => id !== requirementModId);
        if (filtered.length === 0) {
          // Remove the mod entry entirely if no more hidden requirements
          return deleteOrNop(state, ["hiddenRequirements", modId]);
        }
        return setSafe(state, ["hiddenRequirements", modId], filtered);
      }
      return state;
    },
    [actions.setAllModRequirementsHidden as any]: (state, payload) => {
      const { modId, requirementModIds } = payload;
      if (requirementModIds.length === 0) {
        return deleteOrNop(state, ["hiddenRequirements", modId]);
      }
      return setSafe(state, ["hiddenRequirements", modId], requirementModIds);
    },
    [actions.clearAllHiddenRequirements as any]: (state) => {
      return setSafe(state, ["hiddenRequirements"], {});
    },
  },
  defaults: {
    hiddenRequirements: {},
  },
};
