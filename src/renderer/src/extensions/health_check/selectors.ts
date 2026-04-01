import type { IHealthCheckResult } from "../../types/IHealthCheck";
import type { IState } from "../../types/IState";
import type { IHealthCheckPersistentState } from "./reducers/persistent";
import type { IHealthCheckSessionState } from "./reducers/session";
import {
  CYBERPUNK_DIAGNOSTICS_CHECK_ID,
  type HealthCheckId,
  type IModFileInfo,
  type IModMissingRequirements,
  type IModRequirementExt,
} from "./types";
import {
  isFixableCyberpunkDiagnostic,
  type ICyberpunkDiagnosticPayload,
} from "./cyberpunk";

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
 * Get the Cyberpunk diagnostics health check result
 */
export const cyberpunkDiagnosticsCheckResult = (
  state: IState,
): IHealthCheckResult | undefined =>
  healthCheckResult(state, CYBERPUNK_DIAGNOSTICS_CHECK_ID);

/**
 * Get the Cyberpunk missing requirements from the dedicated diagnostics check
 */
export const cyberpunkModRequirementsCheckResult = (
  state: IState,
): Record<string, IModMissingRequirements> | undefined =>
  cyberpunkDiagnosticsCheckResult(state)?.metadata?.modRequirements;

/**
 * Get all missing mod requirements without filtering
 * Returns all requirements including hidden ones
 */
export const allModRequirements = (state: IState): IModRequirementExt[] => {
  const modRequirements = [
    modRequirementsCheckResult(state),
    cyberpunkModRequirementsCheckResult(state),
  ].filter(Boolean) as Record<string, IModMissingRequirements>[];

  if (modRequirements.length === 0) {
    return [];
  }

  const all = modRequirements.flatMap((group) =>
    Object.values(group).flatMap((mod) => mod.missingMods),
  );

  // Deduplicate: the same mod installed multiple times can produce identical
  // requirement entries. Use the same composite key the UI uses for rendering.
  const seen = new Set<string>();
  return all.filter((mod) => {
    const key = [
      mod.requiredBy.modId,
      mod.gameId,
      mod.modId,
      mod.modUrl,
      mod.modName,
      mod.externalRequirement ? "external" : "nexus",
    ].join("|");
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
  const modRequirements = allModRequirements(state);
  if (modRequirements.length === 0) {
    return [];
  }

  const hidden = hiddenRequirements(state);

  return modRequirements.filter(
    (req) => !hidden[req.requiredBy.modId]?.includes(req.id),
  );
};

/**
 * Get the raw Cyberpunk diagnostics emitted by the Cyberpunk diagnostics check
 */
export const cyberpunkDiagnostics = (
  state: IState,
): ICyberpunkDiagnosticPayload[] =>
  (cyberpunkDiagnosticsCheckResult(state)?.metadata?.diagnostics ??
    []) as ICyberpunkDiagnosticPayload[];

/**
 * Get the Cyberpunk diagnostics that can be installed in-app
 */
export const cyberpunkInstallableRequirements = (
  state: IState,
): IModRequirementExt[] =>
  Object.values(cyberpunkModRequirementsCheckResult(state) ?? {}).flatMap(
    (group) => group.missingMods,
  );

/**
 * Get the Cyberpunk diagnostics that are not installable in-app
 */
export const cyberpunkInformationalDiagnostics = (
  state: IState,
): ICyberpunkDiagnosticPayload[] =>
  cyberpunkDiagnostics(state).filter(
    (diagnostic) => !isFixableCyberpunkDiagnostic(diagnostic),
  );

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
    modRequirementsEnabled: true,
  };

/**
 * Check if mod requirements health check suggestions are enabled
 */
export const isModRequirementsEnabled = (state: IState): boolean =>
  healthCheckPersistentState(state).modRequirementsEnabled ?? true;

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
