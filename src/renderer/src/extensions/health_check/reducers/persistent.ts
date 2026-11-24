import { actionsToReducerSpec } from "../../../reducers/builder";
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
}

/**
 * Reducer for health check persistent state
 */
export const persistentReducer = actionsToReducerSpec<IHealthCheckPersistentState, typeof actions>(
  {
    hiddenRequirements: {},
    hiddenFileRequirements: {},
    feedbackGiven: {},
    modRequirementsEnabled: true,
    fileRequirementsEnabled: true,
  },
  actions,
  {
    setModRequirementHidden: (state, payload) => {
      const { modId, requirementId, hidden } = payload;
      const currentHidden = state.hiddenRequirements?.[modId] || [];

      if (hidden && !currentHidden.includes(requirementId)) {
        return {
          ...state,
          hiddenRequirements: {
            ...state.hiddenRequirements,
            [modId]: [...currentHidden, requirementId],
          },
        };
      } else if (!hidden && currentHidden.includes(requirementId)) {
        const filtered = currentHidden.filter((id) => id !== requirementId);
        if (filtered.length === 0) {
          // Remove the mod entry entirely if no more hidden requirements
          const { [modId]: _, ...rest } = state.hiddenRequirements;
          return { ...state, hiddenRequirements: rest };
        }
        return { ...state, hiddenRequirements: { ...state.hiddenRequirements, [modId]: filtered } };
      }
      return state;
    },
    setFileRequirementHidden: (state, payload) => {
      const { sourceFileUID, requirementDefId, hidden } = payload;
      const currentHidden = state.hiddenFileRequirements?.[sourceFileUID] || [];

      if (hidden && !currentHidden.includes(requirementDefId)) {
        return {
          ...state,
          hiddenFileRequirements: {
            ...state.hiddenFileRequirements,
            [sourceFileUID]: [...currentHidden, requirementDefId],
          },
        };
      } else if (!hidden && currentHidden.includes(requirementDefId)) {
        const filtered = currentHidden.filter((id) => id !== requirementDefId);
        if (filtered.length === 0) {
          const { [sourceFileUID]: _, ...rest } = state.hiddenFileRequirements;
          return { ...state, hiddenFileRequirements: rest };
        }
        return {
          ...state,
          hiddenFileRequirements: { ...state.hiddenFileRequirements, [sourceFileUID]: filtered },
        };
      }
      return state;
    },
    setAllModRequirementsHidden: (state, payload) => {
      const { modId, requirementIds } = payload;
      if (requirementIds.length === 0) {
        if (
          state.hiddenRequirements === undefined ||
          !Object.hasOwn(state.hiddenRequirements, modId)
        ) {
          return state;
        }
        const { [modId]: _, ...rest } = state.hiddenRequirements;
        return { ...state, hiddenRequirements: rest };
      }
      return {
        ...state,
        hiddenRequirements: { ...state.hiddenRequirements, [modId]: requirementIds },
      };
    },
    clearAllHiddenRequirements: (state) => ({ ...state, hiddenRequirements: {} }),
    setModRequirementsEnabled: (state, payload) => ({
      ...state,
      modRequirementsEnabled: payload.enabled,
    }),
    setFileRequirementsEnabled: (state, payload) => ({
      ...state,
      fileRequirementsEnabled: payload.enabled,
    }),
    setFeedbackGiven: (state, payload) => {
      const { modId, requirementId } = payload;
      const current = state.feedbackGiven?.[modId] || [];
      if (current.includes(requirementId)) {
        return state;
      }
      return {
        ...state,
        feedbackGiven: { ...state.feedbackGiven, [modId]: [...current, requirementId] },
      };
    },
  },
);
