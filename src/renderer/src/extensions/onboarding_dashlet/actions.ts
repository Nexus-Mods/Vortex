import safeCreateAction from "../../actions/safeCreateAction";

/**
 * completes a step
 */
export const completeStep = safeCreateAction("COMPLETE_STEP", (step: string) => step);
export const resetSteps = safeCreateAction("RESET_STEPS");
