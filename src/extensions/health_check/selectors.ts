import type { IState } from "../../types/IState";
import type { IHealthCheckSessionState } from "./reducers/session";
import type { IHealthCheckPersistentState } from "./reducers/persistent";
import type { IHealthCheckResult } from "../../types/IHealthCheck";
import type {
  HealthCheckId,
  IModMissingRequirements,
  IModRequirementExt,
} from "./types";

export type { HealthCheckId } from "./types";

/**
 * Get the health check session state
 */
export const healthCheckState = (state: IState): IHealthCheckSessionState =>
  state.session?.healthCheck ?? { results: {}, runningChecks: [] };

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
 * Get the array of all missing mod requirements from the health check result
 * Flattens the structure into a single array
 */
export const modRequirementsArray = (state: IState): IModRequirementExt[] => {
  const modRequirements = modRequirementsCheckResult(state);
  if (!modRequirements) {
    return [];
  }

  return Object.values(modRequirements).flatMap((mod) => mod.missingMods);
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
  state.persistent?.healthCheck ?? { hiddenRequirements: {} };

/**
 * Get the hidden requirements map
 * Returns a map of mod nexusModId to array of hidden requirement nexusModIds
 */
export const hiddenRequirements = (
  state: IState,
): { [modId: number]: number[] } =>
  healthCheckPersistentState(state).hiddenRequirements;

/**
 * Check if a specific requirement is hidden for a mod
 */
export const isDependencyHidden = (
  state: IState,
  modId: number,
  requirementModId: number,
): boolean => {
  const hidden = hiddenRequirements(state)[modId] || [];
  return hidden.includes(requirementModId);
};

/**
 * Get all hidden requirement IDs for a specific mod
 */
export const getModHiddenRequirements = (
  state: IState,
  modId: number,
): number[] => hiddenRequirements(state)[modId] || [];
