/**
 * File-level Requirements Health Check
 * Validates that the file-level dependencies of installed mods are satisfied
 */

import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
  type IHealthCheck,
  type IHealthCheckResult,
} from "../../../types/IHealthCheck";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { activeProfile } from "../../profile_management/selectors";
import { setHealthCheckRunning } from "../actions/session";
import { isFileRequirementsEnabled } from "../selectors";
import type { IFileRequirementsCheckMetadata } from "../types";
import { runFileLevelRequirements } from "../utils/runFileLevelRequirements";

export const FILE_REQUIREMENTS_CHECK_ID = "check-file-level-requirements";

/**
 * Create a result object for the file requirements check
 */
function createResult(
  startTime: number,
  status: IHealthCheckResult["status"],
  severity: HealthCheckSeverity,
  message: string,
  options?: {
    details?: string;
    metadata?: IFileRequirementsCheckMetadata;
  },
): IHealthCheckResult {
  return {
    checkId: FILE_REQUIREMENTS_CHECK_ID,
    status,
    severity,
    message,
    details: options?.details,
    metadata: options?.metadata,
    executionTime: Date.now() - startTime,
    timestamp: new Date(),
  };
}

/**
 * Check the file-level requirements of installed mods for the active game
 */
export async function checkFileRequirements(api: IExtensionApi): Promise<IHealthCheckResult> {
  const startTime = Date.now();
  try {
    const state = api.getState();
    const profile = activeProfile(state);

    if (!profile) {
      return createResult(startTime, "passed", HealthCheckSeverity.Info, "No active profile");
    }
    if (!profile.gameId) {
      return createResult(startTime, "passed", HealthCheckSeverity.Info, "No game selected");
    }
    if (!isLoggedIn(state)) {
      return createResult(
        startTime,
        "passed",
        HealthCheckSeverity.Info,
        "Not logged into Nexus Mods",
      );
    }

    const metadata = await runFileLevelRequirements(api);

    const sourcesWithRequirements = Object.values(metadata.fileRequirements);
    const totalRequirements = sourcesWithRequirements.reduce(
      (sum, source) => sum + source.requirements.length,
      0,
    );

    if (totalRequirements === 0 && metadata.errors.length === 0) {
      return createResult(
        startTime,
        "passed",
        HealthCheckSeverity.Info,
        `All file requirements satisfied (checked ${metadata.modsChecked} files)`,
        { metadata },
      );
    }

    const severity = totalRequirements > 0 ? HealthCheckSeverity.Warning : HealthCheckSeverity.Info;
    const status = totalRequirements > 0 ? "warning" : "passed";

    return createResult(
      startTime,
      status,
      severity,
      `Found ${totalRequirements} file requirements across ${sourcesWithRequirements.length} files`,
      { metadata },
    );
  } catch (error) {
    log("error", "Failed to check file-level requirements", unknownToError(error));
    return createResult(
      startTime,
      "error",
      HealthCheckSeverity.Error,
      "Failed to check file-level requirements",
      { details: getErrorMessageOrDefault(error) },
    );
  }
}

/**
 * Registration descriptor for the file-level requirements check. Owns its own
 * enablement gate, running-state bracket and completion notification so that
 * index.ts only has to register it.
 */
export const fileRequirementsHealthCheck: IHealthCheck = {
  id: FILE_REQUIREMENTS_CHECK_ID,
  name: "File Requirements",
  description: "Validates that file-level mod dependencies are satisfied",
  category: HealthCheckCategory.Requirements,
  severity: HealthCheckSeverity.Info,
  triggers: [
    HealthCheckTrigger.ModsChanged,
    HealthCheckTrigger.Manual,
    HealthCheckTrigger.ProfileChanged,
    HealthCheckTrigger.GameChanged,
    HealthCheckTrigger.SettingsChanged,
  ],
  check: async (api: IExtensionApi): Promise<IHealthCheckResult> => {
    if (!isFileRequirementsEnabled(api.getState())) {
      return {
        checkId: FILE_REQUIREMENTS_CHECK_ID,
        status: "passed",
        severity: HealthCheckSeverity.Info,
        message: "File requirements check disabled",
        executionTime: 0,
        timestamp: new Date(),
      };
    }

    api.store?.dispatch(setHealthCheckRunning(FILE_REQUIREMENTS_CHECK_ID, true));
    try {
      const result = await checkFileRequirements(api);
      api.sendNotification({
        type: "info",
        message: "File Requirements check completed",
        displayMS: 5000,
        id: "health-check:file-requirements-complete",
      });
      return result;
    } finally {
      api.store?.dispatch(setHealthCheckRunning(FILE_REQUIREMENTS_CHECK_ID, false));
    }
  },
};
