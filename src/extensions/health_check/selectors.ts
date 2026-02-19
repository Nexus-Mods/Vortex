import type { IState } from "../../renderer/types/IState";
import type { IHealthCheckSessionState } from "./reducers/session";
import type { IHealthCheckPersistentState } from "./reducers/persistent";
import type { IHealthCheckResult } from "../../renderer/types/IHealthCheck";
import type {
  HealthCheckId,
  IModMissingRequirements,
  IModRequirementExt,
  IModFileInfo,
} from "./types";

export type { HealthCheckId } from "./types";

/**
 * Get the health check session state
 */
export const healthCheckState = (state: IState): IHealthCheckSessionState =>
  state.session?.healthCheck ?? {
    results: {},
    runningChecks: [],
    modFiles: {},
    loadingModFiles: [],
  };

/**
 * Get all health check results
 */
export const healthCheckResults = (
  state: IState,
): { [checkId in HealthCheckId]?: IHealthCheckResult } =>
  healthCheckState(state).results;

/**
 * Get a specific health check result by ID
 */
export const healthCheckResult = (
  state: IState,
  checkId: HealthCheckId,
): IHealthCheckResult | undefined => healthCheckState(state).results[checkId];

/**
 * Get the mod requirements from the nexus mod requirements health check
 */
export const modRequirementsCheckResult = (
  state: IState,
): Record<string, IModMissingRequirements> | undefined => {
  const result = healthCheckResult(state, "check-nexus-mod-requirements");
  return result?.metadata?.modRequirements;
};

/**
 * Get all missing mod requirements without filtering
 * Returns all requirements including hidden ones
 */
export const allModRequirements = (state: IState): IModRequirementExt[] => {
  const modRequirements = modRequirementsCheckResult(state);
  if (!modRequirements) {
    return [];
  }

  const all = Object.values(modRequirements).flatMap((mod) => mod.missingMods);

  // Deduplicate: the same mod installed multiple times can produce identical
  // requirement entries. Use the same composite key the UI uses for rendering.
  const seen = new Set<string>();
  return all.filter((mod) => {
    const key = `${mod.requiredBy.modId}-${mod.uid || `${mod.gameId}-${mod.modId || mod.modName}`}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * Get the array of all missing mod requirements from the health check result
 * Flattens the structure into a single array and filters out hidden requirements
 */
export const modRequirementsArray = (state: IState): IModRequirementExt[] => {
  const modRequirements = modRequirementsCheckResult(state);
  if (!modRequirements) {
    return [];
  }

  const hidden = hiddenRequirements(state);

  return Object.values(modRequirements).flatMap((mod) =>
    mod.missingMods.filter((req) => !hidden[mod.nexusModId]?.includes(req.id)),
  );
};

/**
 * Get the list of currently running check IDs
 */
export const runningHealthChecks = (state: IState): HealthCheckId[] =>
  healthCheckState(state).runningChecks as HealthCheckId[];

/**
 * Check if a specific health check is currently running
 */
export const isHealthCheckRunning = (
  state: IState,
  checkId: HealthCheckId,
): boolean => healthCheckState(state).runningChecks.includes(checkId);

/**
 * Check if any health check is currently running
 */
export const isAnyHealthCheckRunning = (state: IState): boolean =>
  healthCheckState(state).runningChecks.length > 0;

/**
 * Get the health check persistent state
 */
export const healthCheckPersistentState = (
  state: IState,
): IHealthCheckPersistentState =>
  state.persistent?.healthCheck ?? {
    hiddenRequirements: {},
    feedbackGiven: {},
  };

/**
 * Get the hidden requirements map
 * Returns a map of mod nexusModId to array of hidden requirement IDs
 */
export const hiddenRequirements = (
  state: IState,
): { [modId: number]: string[] } =>
  healthCheckPersistentState(state).hiddenRequirements;

/**
 * Check if a specific requirement is hidden for a mod
 */
export const isDependencyHidden = (
  state: IState,
  modId: number,
  requirementId: string,
): boolean => {
  const hidden = hiddenRequirements(state)[modId] || [];
  return hidden.includes(requirementId);
};

/**
 * Get all hidden requirement IDs for a specific mod
 */
export const getModHiddenRequirements = (
  state: IState,
  modId: number,
): string[] => hiddenRequirements(state)[modId] || [];

/**
 * Get the feedback given map
 * Returns a map of mod nexusModId to array of requirement IDs that received feedback
 */
export const feedbackGivenMap = (
  state: IState,
): { [modId: number]: string[] } =>
  healthCheckPersistentState(state).feedbackGiven ?? {};

/**
 * Get cached mod files for a specific mod
 */
export const getModFiles = (
  state: IState,
  modId: number,
): IModFileInfo[] | undefined => healthCheckState(state).modFiles?.[modId];

/**
 * Check if mod files are currently being loaded
 */
export const isModFilesLoading = (state: IState, modId: number): boolean =>
  healthCheckState(state).loadingModFiles?.includes(modId) ?? false;
