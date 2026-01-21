import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import { HealthCheckSeverity } from "../../../types/IHealthCheck";
import { log } from "../../../util/log";
import { getErrorMessageOrDefault, unknownToError } from "../../../shared/errors";
import { activeProfile } from "../../profile_management/selectors";
import { isLoggedIn } from "../../nexus_integration/selectors";
import type { IMod } from "../../mod_management/types/IMod";
import type { IModRequirements } from "@nexusmods/nexus-api";
import { getSafe } from "../../../util/storeHelper";
import { getHealthCheckWebContents } from "../main";
import { requestModRequirementsFromRenderer } from "../ipc/nexus-bridge";
import { setModAttribute } from "../../../actions";
import {
  setHealthCheckResult,
  setHealthCheckRunning,
} from "../actions/session";
import type {
  PredefinedCheckId,
  IModRequirementsCheckMetadata,
  IModRequirementsCheckParams,
  IModMissingRequirements,
} from "../types";
import { renderModName } from "../../../util/api";

export type { PredefinedCheckId } from "../types";

export type PredefinedCheckFunction = (
  api: IExtensionApi,
  params?: unknown,
) => Promise<IHealthCheckResult>;

const REQUIREMENTS_CHECK_ID: PredefinedCheckId = "check-nexus-mod-requirements";

/**
 * Create a result object for the mod requirements check
 */
function createResult(
  startTime: number,
  status: IHealthCheckResult["status"],
  severity: HealthCheckSeverity,
  message: string,
  options?: {
    details?: string;
    metadata?: IModRequirementsCheckMetadata;
  },
): IHealthCheckResult {
  return {
    checkId: REQUIREMENTS_CHECK_ID,
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
 * Build human-readable details string from mod issues
 */
function buildDetailsString(
  modsWithIssues: IModMissingRequirements[],
  errors: string[],
): string {
  const parts: string[] = [];

  const modsWithMissingMods = modsWithIssues.filter(
    (m) => m.missingMods.length > 0,
  );
  if (modsWithMissingMods.length > 0) {
    parts.push("=== Missing Mod Requirements ===");
    for (const modEntry of modsWithMissingMods) {
      parts.push(`${modEntry.modName}:`);
      for (const req of modEntry.missingMods) {
        parts.push(`  • ${req.name}${req.notes ? ` (${req.notes})` : ""}`);
      }
    }
    parts.push("");
  }

  const modsWithDlc = modsWithIssues.filter(
    (m) => m.dlcRequirements.length > 0,
  );
  if (modsWithDlc.length > 0) {
    parts.push("=== DLC Requirements (Please Verify) ===");
    for (const modEntry of modsWithDlc) {
      parts.push(`${modEntry.modName}:`);
      for (const req of modEntry.dlcRequirements) {
        parts.push(`  • ${req.name}${req.notes ? ` (${req.notes})` : ""}`);
      }
    }
    parts.push("");
  }

  if (errors.length > 0) {
    parts.push("=== Errors ===");
    parts.push(...errors);
  }

  return parts.join("\n").trim();
}

/**
 * Helper to get enabled mods for the active profile
 */
function getEnabledMods(api: IExtensionApi, gameId: string): IMod[] {
  const state = api.getState();
  const profile = activeProfile(state);
  if (!profile) return [];

  const mods = state.persistent.mods[gameId] || {};
  const enabledModIds = Object.keys(profile.modState || {}).filter((modId) =>
    getSafe(profile.modState, [modId, "enabled"], false),
  );

  return enabledModIds.map((id) => mods[id]).filter((m) => m !== undefined);
}

/**
 * Registry of predefined checks that can be executed in main process
 */
export const PREDEFINED_CHECKS: Record<
  PredefinedCheckId,
  PredefinedCheckFunction
> = {
  /**
   * Check Nexus mod requirements via API
   * Fetches requirements from Nexus API and checks if they are satisfied
   * This runs in main process to handle heavy API calls and processing
   */
  [REQUIREMENTS_CHECK_ID]: async (
    api: IExtensionApi,
    params?: IModRequirementsCheckParams,
  ): Promise<IHealthCheckResult> => {
    const startTime = Date.now();
    try {
      const state = api.getState();
      const profile = activeProfile(state);

      if (!profile) {
        return createResult(
          startTime,
          "passed",
          HealthCheckSeverity.Info,
          "No active profile",
        );
      }

      const gameId = profile.gameId;
      if (!gameId) {
        return createResult(
          startTime,
          "passed",
          HealthCheckSeverity.Info,
          "No game selected",
        );
      }

      if (!isLoggedIn(state)) {
        return createResult(
          startTime,
          "passed",
          HealthCheckSeverity.Info,
          "Not logged into Nexus Mods",
        );
      }

      const useCachedOnly = params?.cachedOnly === true;

      // Get webContents for IPC bridge to renderer (for fetching requirements via Nexus API)
      const webContents = getHealthCheckWebContents();

      const enabledMods = getEnabledMods(api, gameId).filter(
        (mod: IMod) =>
          mod.type !== "collection" &&
          mod.attributes?.modId &&
          mod.attributes?.source === "nexus",
      );

      if (enabledMods.length === 0) {
        return createResult(
          startTime,
          "passed",
          HealthCheckSeverity.Info,
          "No Nexus mods installed",
        );
      }

      // Build typed metadata for the result
      const metadata: IModRequirementsCheckMetadata = {
        gameId,
        modsChecked: 0,
        modsFetched: 0,
        modRequirements: {},
        errors: [],
      };

      const modLimit = params?.limit ?? enabledMods.length;
      const modsToCheck = enabledMods.slice(0, modLimit);

      // Build a map of requirements: first from cache, then fetch missing ones in batch
      const requirementsMap: {
        [modId: number]: Partial<IModRequirements> | undefined;
      } = {};
      const modsNeedingFetch: number[] = [];

      // First pass: collect cached requirements and identify mods needing fetch
      for (const mod of modsToCheck) {
        const modId = mod.attributes?.modId;
        if (!modId) continue;

        const cachedRequirements = mod.attributes?.requirements as
          | Partial<IModRequirements>
          | undefined;

        if (cachedRequirements) {
          requirementsMap[modId] = cachedRequirements;
        } else if (!useCachedOnly) {
          modsNeedingFetch.push(modId);
        }
      }

      // Batch fetch requirements for mods that don't have cached data
      if (modsNeedingFetch.length > 0 && webContents) {
        try {
          const fetchedRequirements = await requestModRequirementsFromRenderer(
            webContents,
            gameId,
            modsNeedingFetch,
          );

          if (fetchedRequirements) {
            for (const [modIdStr, requirements] of Object.entries(
              fetchedRequirements,
            )) {
              const modId = parseInt(modIdStr, 10);
              requirementsMap[modId] = requirements;

              // Cache the fetched requirements in mod attributes
              const mod = modsToCheck.find(
                (m) => m.attributes?.modId === modId,
              );
              if (mod && requirements) {
                api.store?.dispatch(
                  setModAttribute(gameId, mod.id, "requirements", requirements),
                );
              }
            }
          }
        } catch (err) {
          log("warn", "Failed to fetch mod requirements", {
            error: (err as Error).message,
          });
          metadata.errors.push(
            `Failed to fetch requirements: ${(err as Error).message}`,
          );
        }
      }

      // Second pass: process requirements and check for missing dependencies
      for (const mod of modsToCheck) {
        const modId = mod.attributes?.modId;
        const modName = renderModName(mod);

        if (!modId) continue;

        const requirements = requirementsMap[modId];
        if (!requirements) {
          continue; // Skip if no requirements available
        }

        metadata.modsChecked++;

        // Helper to get or create the mod's requirements entry
        const getModEntry = (): IModMissingRequirements => {
          if (!metadata.modRequirements[mod.id]) {
            metadata.modRequirements[mod.id] = {
              modId: mod.id,
              nexusModId: modId,
              modName,
              missingMods: [],
              dlcRequirements: [],
            };
          }
          return metadata.modRequirements[mod.id];
        };

        // Check Nexus mod requirements
        if (requirements.nexusRequirements?.nodes) {
          for (const req of requirements.nexusRequirements.nodes) {
            const requiredModId = parseInt(req.modId, 10);

            // Check if required mod is installed and enabled
            const isInstalled = enabledMods.some(
              (m) => m.attributes?.modId === requiredModId,
            );

            if (!isInstalled) {
              getModEntry().missingMods.push({
                nexusModId: requiredModId,
                name: req.modName,
                notes: req.notes,
                nexusUrl: req.url,
              });
            }
          }
        }

        // Check DLC requirements
        if (requirements.dlcRequirements) {
          for (const dlc of requirements.dlcRequirements) {
            getModEntry().dlcRequirements.push({
              name: dlc.gameExpansion?.name || "Unknown DLC",
              dlcId: dlc.gameExpansion?.id,
              notes: dlc.notes,
            });
          }
        }
      }

      // Count totals from the map
      const modsWithIssues = Object.values(metadata.modRequirements);
      const totalMissingMods = modsWithIssues.reduce(
        (sum, m) => sum + m.missingMods.length,
        0,
      );
      const totalDlcRequirements = modsWithIssues.reduce(
        (sum, m) => sum + m.dlcRequirements.length,
        0,
      );
      const totalIssues = totalMissingMods + totalDlcRequirements;

      if (totalIssues === 0 && metadata.errors.length === 0) {
        return createResult(
          startTime,
          "passed",
          HealthCheckSeverity.Info,
          `All Nexus mod requirements satisfied (checked ${metadata.modsChecked} mods)`,
          { metadata },
        );
      }

      const details = buildDetailsString(modsWithIssues, metadata.errors);
      const severity =
        totalMissingMods > 0
          ? HealthCheckSeverity.Warning
          : HealthCheckSeverity.Info;
      const status = totalMissingMods > 0 ? "warning" : "passed";

      return createResult(
        startTime,
        status,
        severity,
        `Found ${totalIssues} requirement issues (${totalMissingMods} mod, ${totalDlcRequirements} DLC) across ${modsWithIssues.length} mods`,
        { details, metadata },
      );
    } catch (error) {
      log("error", "Failed to check Nexus mod requirements", unknownToError(error));
      return createResult(
        startTime,
        "error",
        HealthCheckSeverity.Error,
        "Failed to check Nexus mod requirements",
        { details: getErrorMessageOrDefault(error) },
      );
    }
  },
};

/**
 * Execute a predefined check by ID and store the result in Redux
 */
export async function executePredefinedCheck(
  checkId: PredefinedCheckId,
  api: IExtensionApi,
  params?: unknown,
): Promise<IHealthCheckResult | null> {
  const checkFn = PREDEFINED_CHECKS[checkId];
  if (!checkFn) {
    log("warn", "Predefined check not found", { checkId });
    return null;
  }

  const startTime = Date.now();
  api.store?.dispatch(setHealthCheckRunning(checkId, true));

  try {
    const result = await checkFn(api, params);
    result.checkId = checkId;
    api.store?.dispatch(setHealthCheckResult(checkId, result));
    return result;
  } catch (error) {
    log("error", "Predefined check failed", {
      checkId,
      error: (error as Error).message,
    });
    const errorResult: IHealthCheckResult = {
      checkId,
      status: "error",
      severity: HealthCheckSeverity.Error,
      message: `Check failed: ${(error as Error).message}`,
      timestamp: new Date(startTime),
      executionTime: 0,
    };
    api.store?.dispatch(setHealthCheckResult(checkId, errorResult));
    return errorResult;
  } finally {
    api.store?.dispatch(setHealthCheckRunning(checkId, false));
  }
}

/**
 * Get list of available predefined checks
 */
export function getAvailablePredefinedChecks(): PredefinedCheckId[] {
  return Object.keys(PREDEFINED_CHECKS) as PredefinedCheckId[];
}
