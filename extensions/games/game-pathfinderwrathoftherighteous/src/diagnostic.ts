import path from "node:path";

import { types } from "vortex-api";

import { WOTR_MOD_TYPES } from "./installers";

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
  id: "wotr-mod-has-files",
  name: "Pathfinder: WotR — mod has files",
  description: "Verifies that the installer produced at least one file.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (mod.files.length === 0) {
      return warning(
        "wotr-mod-has-files",
        "Installer produced no files",
        "An installer matched but emitted zero file instructions.",
        startedAt,
      );
    }
    return passed("wotr-mod-has-files", "Install output has at least one file", startedAt);
  },
};

/**
 * UMM mods (tagged with the wotr-umm-mod modType) must contain an Info.json
 * file. Its absence after install means the archive matched the UMM heuristic
 * (had an Info.json pre-strip) but the copy instructions lost it -- typically
 * a root-stripping bug.
 */
const ummModHasInfoJson: types.IModHealthCheck = {
  id: "wotr-umm-mod-has-info-json",
  name: "Pathfinder: WotR — UMM mod has Info.json",
  description: "Verifies that UMM mods retain their Info.json after installation.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    const modType = mod.attributes.modType as string | undefined;
    if (modType !== WOTR_MOD_TYPES.ummMod) {
      return passed("wotr-umm-mod-has-info-json", "Not a UMM mod; check not applicable", startedAt);
    }
    const hasInfoJson = mod.files.some((f) => path.basename(f).toLowerCase() === "info.json");
    if (!hasInfoJson) {
      return warning(
        "wotr-umm-mod-has-info-json",
        "UMM mod missing Info.json after install",
        "The archive was identified as a UMM mod (it contained Info.json) but " +
          "the installed output does not include Info.json. This likely indicates " +
          "a root-stripping issue in the installer.",
        startedAt,
      );
    }
    return passed("wotr-umm-mod-has-info-json", "UMM mod retains Info.json", startedAt);
  },
};

export const healthChecks: types.IModHealthCheck[] = [modHasFilesCheck, ummModHasInfoJson];
