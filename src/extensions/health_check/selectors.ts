import type { IState } from "../../types/IState";
import type { IHealthCheckSessionState } from "./reducers/session";
import type { IHealthCheckResult } from "../../types/IHealthCheck";
import type { HealthCheckId } from "./types";

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
): IHealthCheckResult | undefined => {
  const result = healthCheckResult(state, "check-nexus-mod-requirements");
  return result?.metadata?.modRequirements;
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
