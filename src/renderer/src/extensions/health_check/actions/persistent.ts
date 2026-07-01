import { createAction } from "redux-act";

/**
 * Set whether a mod-level requirement is hidden, keyed by requiring mod + the
 * requirement's own Nexus id (so external requirements work too).
 */
export const setModRequirementHidden = createAction(
  "SET_HEALTH_CHECK_MOD_REQUIREMENT_HIDDEN",
  (modId: number, requirementId: string, hidden: boolean) => ({
    modId,
    requirementId,
    hidden,
  }),
);

/** Set whether a file-level requirement is hidden, keyed by source file + requirement definition id. */
export const setFileRequirementHidden = createAction(
  "SET_HEALTH_CHECK_FILE_REQUIREMENT_HIDDEN",
  (sourceFileUID: string, requirementDefId: string, hidden: boolean) => ({
    sourceFileUID,
    requirementDefId,
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
 * Record that feedback was given for a specific requirement
 */
export const setFeedbackGiven = createAction(
  "SET_HEALTH_CHECK_FEEDBACK_GIVEN",
  (modId: number, requirementId: string) => ({
    modId,
    requirementId,
  }),
);
