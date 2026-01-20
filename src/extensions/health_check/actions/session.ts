import safeCreateAction from "../../../actions/safeCreateAction";
import type { IHealthCheckResult } from "../../../types/IHealthCheck";

/**
 * Set the result of a health check
 */
export const setHealthCheckResult = safeCreateAction(
  "SET_HEALTH_CHECK_RESULT",
  (checkId: string, result: IHealthCheckResult) => ({ checkId, result }),
);

/**
 * Clear a specific health check result
 */
export const clearHealthCheckResult = safeCreateAction(
  "CLEAR_HEALTH_CHECK_RESULT",
  (checkId: string) => checkId,
);

/**
 * Clear all health check results
 */
export const clearAllHealthCheckResults = safeCreateAction(
  "CLEAR_ALL_HEALTH_CHECK_RESULTS",
  () => undefined,
);

/**
 * Set whether a health check is currently running
 */
export const setHealthCheckRunning = safeCreateAction(
  "SET_HEALTH_CHECK_RUNNING",
  (checkId: string, running: boolean) => ({ checkId, running }),
);
