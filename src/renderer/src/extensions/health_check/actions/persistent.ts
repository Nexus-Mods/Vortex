import { createAction } from "redux-act";

/**
 * Set whether a specific requirement is hidden for a mod
 * Uses the unique requirement ID from Nexus API instead of modId to properly support external requirements
 */
export const setRequirementHidden = createAction(
  "SET_HEALTH_CHECK_REQUIREMENT_HIDDEN",
  (modId: number, requirementId: string, hidden: boolean) => ({
    modId,
    requirementId,
    hidden,
  }),
);

/**
 * Set all requirements for a mod as hidden
 */
export const setAllModRequirementsHidden = createAction(
  "SET_ALL_MOD_REQUIREMENTS_HIDDEN",
  (modId: number, requirementIds: string[]) => ({
    modId,
    requirementIds,
  }),
);

/**
 * Clear all hidden requirements for all mods
 */
export const clearAllHiddenRequirements = createAction(
  "CLEAR_ALL_HEALTH_CHECK_HIDDEN_REQUIREMENTS",
  () => undefined,
);

/**
 * Enable or disable mod requirements health check suggestions
 */
export const setModRequirementsEnabled = createAction(
  "SET_HEALTH_CHECK_MOD_REQUIREMENTS_ENABLED",
  (enabled: boolean) => ({ enabled }),
);

/**
 * Enable or disable file-level requirements health check suggestions
 */
export const setFileRequirementsEnabled = createAction(
  "SET_HEALTH_CHECK_FILE_REQUIREMENTS_ENABLED",
  (enabled: boolean) => ({ enabled }),
);

/**
 * Set whether the file-level requirements Unleash flag is enabled.
 * Persisted so the last-known value survives restarts and brief Unleash outages.
 */
export const setFileRequirementsFlagEnabled = createAction(
  "SET_HEALTH_CHECK_FILE_REQUIREMENTS_FLAG",
  (enabled: boolean) => ({ enabled }),
);

/**
 * Record that feedback was given for a specific requirement
 */
export const setFeedbackGiven = createAction(
  "SET_HEALTH_CHECK_FEEDBACK_GIVEN",
  (modId: number, requirementId: string) => ({
    modId,
    requirementId,
  }),
);
