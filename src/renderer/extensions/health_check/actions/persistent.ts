import safeCreateAction from "../../../actions/safeCreateAction";

/**
 * Set whether a specific requirement is hidden for a mod
 * Uses the unique requirement ID from Nexus API instead of modId to properly support external requirements
 */
export const setRequirementHidden = safeCreateAction(
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
export const setAllModRequirementsHidden = safeCreateAction(
  "SET_ALL_MOD_REQUIREMENTS_HIDDEN",
  (modId: number, requirementIds: string[]) => ({
    modId,
    requirementIds,
  }),
);

/**
 * Clear all hidden requirements for all mods
 */
export const clearAllHiddenRequirements = safeCreateAction(
  "CLEAR_ALL_HEALTH_CHECK_HIDDEN_REQUIREMENTS",
  () => undefined,
);

/**
 * Enable or disable mod requirements health check suggestions
 */
export const setModRequirementsEnabled = safeCreateAction(
  "SET_HEALTH_CHECK_MOD_REQUIREMENTS_ENABLED",
  (enabled: boolean) => ({ enabled }),
);

/**
 * Record that feedback was given for a specific requirement
 */
export const setFeedbackGiven = safeCreateAction(
  "SET_HEALTH_CHECK_FEEDBACK_GIVEN",
  (modId: number, requirementId: string) => ({
    modId,
    requirementId,
  }),
);
