import { useSyncExternalStore } from "react";

import { FlagService } from "@/FlagService";

// STA-574 experiment. The PR and ticket cover how to read the results and how to remove it.

const FLAG = "vortex-sta-574-login-prompt";

export type LoginPromptCohort = "test" | "control";

let fixedCohort: LoginPromptCohort | undefined;

// Reads the flag map directly: `getFlag` counts an evaluation for Unleash on every call.
const liveCohort = (): LoginPromptCohort =>
  FlagService.instance?.flags.has(FLAG) ? "test" : "control";

/** The session's cohort once fixed; until then, whatever the flags say so far. */
export const loginPromptCohort = (): LoginPromptCohort => fixedCohort ?? liveCohort();

/**
 * Fixes the session's cohort the first time the user would see a difference, so the prompt, the
 * dialog and the login event all agree even if flags arrive mid-session. Counts as the flag's one
 * evaluation.
 */
export const fixLoginPromptCohort = (): LoginPromptCohort => {
  fixedCohort ??= FlagService.instance?.getFlag(FLAG) !== undefined ? "test" : "control";
  return fixedCohort;
};

const subscribe = (onChange: () => void): (() => void) =>
  FlagService.instance?.subscribe(() => onChange()) ?? (() => undefined);

/** `loginPromptCohort`, re-rendering when flags arrive. */
export const useLoginPromptCohort = (): LoginPromptCohort =>
  useSyncExternalStore(subscribe, loginPromptCohort);
