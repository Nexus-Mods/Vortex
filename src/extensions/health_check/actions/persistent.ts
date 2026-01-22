import safeCreateAction from "../../../actions/safeCreateAction";

/**
 * Set whether a specific requirement is hidden for a mod
 */
export const setRequirementHidden = safeCreateAction(
  "SET_HEALTH_CHECK_REQUIREMENT_HIDDEN",
  (modId: number, requirementModId: number, hidden: boolean) => ({
    modId,
    requirementModId,
    hidden,
  }),
);

/**
 * Set all requirements for a mod as hidden
 */
export const setAllModRequirementsHidden = safeCreateAction(
  "SET_ALL_MOD_REQUIREMENTS_HIDDEN",
  (modId: number, requirementModIds: number[]) => ({
    modId,
    requirementModIds,
  }),
);

/**
 * Clear all hidden requirements for all mods
 */
export const clearAllHiddenRequirements = safeCreateAction(
  "CLEAR_ALL_HEALTH_CHECK_HIDDEN_REQUIREMENTS",
  () => undefined,
);
