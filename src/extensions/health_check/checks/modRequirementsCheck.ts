/**
 * Mod Requirements Health Check
 * Validates that all Nexus mod requirements are satisfied
 */

import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import type { IHealthCheckResult } from "../../../renderer/types/IHealthCheck";
import { HealthCheckSeverity } from "../../../renderer/types/IHealthCheck";
import { log } from "../../../renderer/util/log";
import {
  getErrorMessageOrDefault,
  unknownToError,
} from "../../../shared/errors";
import { activeProfile } from "../../profile_management/selectors";
import { isLoggedIn } from "../../nexus_integration/selectors";
import type { IMod } from "../../mod_management/types/IMod";
import type { IModRequirements } from "@nexusmods/nexus-api";
import { getSafe } from "../../../renderer/util/storeHelper";
import { setModAttribute } from "../../../renderer/actions";
import type {
  IModRequirementsCheckMetadata,
  IModMissingRequirements,
  IModRequirementsCheckParams,
} from "../types";
import {
  getGame,
  nexusGameId,
  renderModName,
} from "../../../renderer/util/api";
import { makeModUID } from "../../nexus_integration/util/UIDs";
import { batchDispatch } from "../../../renderer/util/util";
import { numericGameIdToDomainName } from "../../nexus_integration/util/convertGameId";

export const MOD_REQUIREMENTS_CHECK_ID = "check-nexus-mod-requirements";

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
    checkId: MOD_REQUIREMENTS_CHECK_ID,
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
        parts.push(`  • ${req.modName}${req.notes ? ` (${req.notes})` : ""}`);
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
 * Check Nexus mod requirements
 * Fetches requirements from Nexus API and checks if they are satisfied
 */
export async function checkModRequirements(
  api: IExtensionApi,
  params?: IModRequirementsCheckParams,
): Promise<IHealthCheckResult> {
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

    // Build lookup structures for O(1) access
    const installedModIds = new Set<number>();
    const modsByNexusId = new Map<number, IMod>();

    for (const mod of enabledMods) {
      const nexusModId = mod.attributes?.modId;
      if (nexusModId) {
        installedModIds.add(nexusModId);
        modsByNexusId.set(nexusModId, mod);
      }
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

    // Build a map of requirements: first from cache, then fetch missing ones
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
    if (modsNeedingFetch.length > 0) {
      try {
        const nexusGetModRequirements = api.ext.nexusGetModRequirements as
          | ((
              gameId: string,
              modIds: number[],
            ) => Promise<{ [modId: number]: Partial<IModRequirements> }>)
          | undefined;

        if (!nexusGetModRequirements) {
          throw new Error("Nexus API not available");
        }

        const fetchedRequirements = await nexusGetModRequirements(
          gameId,
          modsNeedingFetch,
        );

        if (fetchedRequirements) {
          const cacheActions: ReturnType<typeof setModAttribute>[] = [];

          for (const [modIdStr, requirements] of Object.entries(
            fetchedRequirements,
          )) {
            const modId = parseInt(modIdStr, 10);
            requirementsMap[modId] = requirements;
            metadata.modsFetched++;

            const mod = modsByNexusId.get(modId);
            if (mod && requirements) {
              cacheActions.push(
                setModAttribute(gameId, mod.id, "requirements", requirements),
              );
            }
          }

          if (cacheActions.length > 0 && api.store) {
            batchDispatch(api.store.dispatch, cacheActions);
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
      if (!modId) continue;
      const gameId = mod.attributes.downloadGame;

      // Get Nexus domain name for the requiring mod
      const game = getGame(gameId);
      const requiringModNexusDomain = game ? nexusGameId(game, gameId) : gameId;

      const requirements = requirementsMap[modId];
      if (!requirements) {
        continue;
      }

      metadata.modsChecked++;

      // Lazy compute modName only when needed
      let modName: string | undefined;
      const getModName = () => {
        if (modName === undefined) {
          modName = renderModName(mod);
        }
        return modName;
      };

      const getModEntry = (): IModMissingRequirements => {
        if (!metadata.modRequirements[mod.id]) {
          metadata.modRequirements[mod.id] = {
            gameId,
            modId: mod.id,
            nexusModId: modId,
            modName: getModName(),
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
          const requiredGameId = parseInt(req.gameId, 10);
          const domainName = numericGameIdToDomainName(requiredGameId);
          // Fallback for gameId if domain name not found (to satisfy type contract)
          const gameIdForStorage = domainName ?? gameId;

          if (!installedModIds.has(requiredModId)) {
            getModEntry().missingMods.push({
              ...req,
              modId: requiredModId,
              gameId: gameIdForStorage,
              uid: makeModUID({
                modId: req.modId,
                fileId: "0",
                gameId: gameIdForStorage,
              }),
              requiredBy: {
                modId,
                modName: getModName(),
                // The nexus mods URL of the mod that requires this dependency
                modUrl: requiringModNexusDomain
                  ? `https://www.nexusmods.com/${requiringModNexusDomain}/mods/${modId}`
                  : undefined,
              },
              // The URL of the required dependency mod
              modUrl:
                (req.url && req.url.trim()) ||
                (domainName
                  ? `https://www.nexusmods.com/${domainName}/mods/${requiredModId}`
                  : undefined),
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

    // Count totals
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
    log(
      "error",
      "Failed to check Nexus mod requirements",
      unknownToError(error),
    );
    return createResult(
      startTime,
      "error",
      HealthCheckSeverity.Error,
      "Failed to check Nexus mod requirements",
      { details: getErrorMessageOrDefault(error) },
    );
  }
}
