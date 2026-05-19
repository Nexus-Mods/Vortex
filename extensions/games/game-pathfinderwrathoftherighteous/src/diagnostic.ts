import { types } from "vortex-api";

const CATEGORY = types.HealthCheckCategory.Mods;
const TRIGGERS: types.HealthCheckTrigger[] = [
  types.HealthCheckTrigger.ModsChanged,
  types.HealthCheckTrigger.Manual,
];
const SEVERITY_INFO = types.HealthCheckSeverity.Info;
const SEVERITY_WARNING = types.HealthCheckSeverity.Warning;

function passed(checkId: string, message: string, startedAt: number): types.IHealthCheckResult {
  return {
    checkId,
    status: "passed",
    severity: SEVERITY_INFO,
    message,
    executionTime: Date.now() - startedAt,
    timestamp: new Date(),
  };
}

function warning(
  checkId: string,
  message: string,
  details: string,
  startedAt: number,
): types.IHealthCheckResult {
  return {
    checkId,
    status: "warning",
    severity: SEVERITY_WARNING,
    message,
    details,
    executionTime: Date.now() - startedAt,
    timestamp: new Date(),
  };
}

/**
 * Fails when an install produced zero files. Catches cases where the
 * installer's filter logic discards every entry.
 */
const modHasFilesCheck: types.IModHealthCheck = {
  id: "pathfinderwrathoftherighteous-mod-has-files",
  name: "Pathfinder: WotR — mod has files",
  description: "Verifies that the installer produced at least one file.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (mod.files.length === 0) {
      return warning(
        "pathfinderwrathoftherighteous-mod-has-files",
        "Installer produced no files",
        "An installer matched but emitted zero file instructions.",
        startedAt,
      );
    }
    return passed(
      "pathfinderwrathoftherighteous-mod-has-files",
      "Install output has at least one file",
      startedAt,
    );
  },
};

export const healthChecks: types.IModHealthCheck[] = [modHasFilesCheck];
