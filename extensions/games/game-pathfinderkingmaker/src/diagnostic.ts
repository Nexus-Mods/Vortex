/**
 * Health checks for Pathfinder: Kingmaker. Validates that the installer
 * produced reasonable output for each mod.
 *
 * Types are defined inline because the HealthCheck type surface is not yet
 * exported from `vortex-api` on master. The shapes match
 * `IModHealthCheck` / `IHealthCheckResult` from the renderer.
 */

interface IModCheckContext {
  files: string[];
  attributes: Record<string, unknown>;
}

interface IHealthCheckResult {
  checkId: string;
  status: "passed" | "failed" | "warning" | "error";
  severity: string;
  message: string;
  details?: string;
  executionTime: number;
  timestamp: Date;
}

interface IModHealthCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  triggers: string[];
  checkMod: (api: unknown, mod: IModCheckContext) => Promise<IHealthCheckResult>;
}

function passed(checkId: string, message: string, startedAt: number): IHealthCheckResult {
  return {
    checkId,
    status: "passed",
    severity: "info",
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
): IHealthCheckResult {
  return {
    checkId,
    status: "warning",
    severity: "warning",
    message,
    details,
    executionTime: Date.now() - startedAt,
    timestamp: new Date(),
  };
}

export const healthChecks: IModHealthCheck[] = [
  {
    id: "pfk-mod-has-files",
    name: "Pathfinder: Kingmaker -- mod has files",
    description: "Verifies that the installer produced at least one file.",
    category: "mods",
    severity: "warning",
    triggers: ["mods-changed", "manual"],
    checkMod: async (_api, mod) => {
      const startedAt = Date.now();
      if (mod.files.length === 0) {
        return warning(
          "pfk-mod-has-files",
          "Installer produced no files",
          "An installer matched but emitted zero file instructions.",
          startedAt,
        );
      }
      return passed("pfk-mod-has-files", "Install output has at least one file", startedAt);
    },
  },
];
