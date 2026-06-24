import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe, deleteOrNop } from "../../../util/storeHelper";
import * as actions from "../actions/persistent";

export interface IHealthCheckPersistentState {
  /**
   * Mod-level hide store: requiring mod nexusModId -> hidden requirement ids.
   * Persisted key kept as `hiddenRequirements` for backwards compat (selector is
   * `hiddenModRequirements`).
   */
  hiddenRequirements: { [modId: number]: string[] };
  /** File-level hide store: source file UID -> hidden requirement definition ids. */
  hiddenFileRequirements: { [sourceFileUID: string]: string[] };
  /**
   * Map of mod nexusModId to array of requirement IDs that have received feedback
   * Prevents users from submitting feedback multiple times for the same requirement
   */
  feedbackGiven: { [modId: number]: string[] };
  /** Whether mod requirements health check suggestions are enabled */
  modRequirementsEnabled: boolean;
  /** Whether file-level requirements health check suggestions are enabled */
  fileRequirementsEnabled: boolean;
  /**
   * Last-known enabled state of the file-level requirements Unleash flag.
   * Persisted so the feature keeps its last-known state across restarts / brief outages;
   * only the default applies before any flag state has ever been received.
   */
  fileRequirementsFlagEnabled: boolean;
}

/**
 * Reducer for health check persistent state
 */
export const persistentReducer: IReducerSpec<IHealthCheckPersistentState> = {
  reducers: {
    [actions.setModRequirementHidden as any]: (state, payload) => {
      const { modId, requirementId, hidden } = payload;
      const currentHidden = state.hiddenRequirements?.[modId] || [];

      if (hidden && !currentHidden.includes(requirementId)) {
        return setSafe(state, ["hiddenRequirements", modId], [...currentHidden, requirementId]);
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
    [actions.setFileRequirementHidden as any]: (state, payload) => {
      const { sourceFileUID, requirementDefId, hidden } = payload;
      const currentHidden = state.hiddenFileRequirements?.[sourceFileUID] || [];

      if (hidden && !currentHidden.includes(requirementDefId)) {
        return setSafe(
          state,
          ["hiddenFileRequirements", sourceFileUID],
          [...currentHidden, requirementDefId],
        );
      } else if (!hidden && currentHidden.includes(requirementDefId)) {
        const filtered = currentHidden.filter((id) => id !== requirementDefId);
        if (filtered.length === 0) {
          return deleteOrNop(state, ["hiddenFileRequirements", sourceFileUID]);
        }
        return setSafe(state, ["hiddenFileRequirements", sourceFileUID], filtered);
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
    [actions.setModRequirementsEnabled as any]: (state, payload) => {
      return setSafe(state, ["modRequirementsEnabled"], payload.enabled);
    },
    [actions.setFileRequirementsEnabled as any]: (state, payload) => {
      return setSafe(state, ["fileRequirementsEnabled"], payload.enabled);
    },
    [actions.setFileRequirementsFlagEnabled as any]: (state, payload) => {
      return setSafe(state, ["fileRequirementsFlagEnabled"], payload.enabled);
    },
    [actions.setFeedbackGiven as any]: (state, payload) => {
      const { modId, requirementId } = payload;
      const current = state.feedbackGiven?.[modId] || [];
      if (current.includes(requirementId)) {
        return state;
      }
      return setSafe(state, ["feedbackGiven", modId], [...current, requirementId]);
    },
  },
  defaults: {
    hiddenRequirements: {},
    hiddenFileRequirements: {},
    feedbackGiven: {},
    modRequirementsEnabled: true,
    fileRequirementsEnabled: true,
    fileRequirementsFlagEnabled: false,
  },
};
