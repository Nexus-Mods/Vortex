/**
 * Mod Requirements Health Check
 * Validates that all Nexus mod requirements are satisfied
 */

import type { IModRequirements } from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";

import { getModFilesWithCache } from "@/extensions/health_check/utils/modRequirements/modFiles";
import {
  chunked,
  createKeyedCache,
  resolveCached,
  type KeyedCache,
} from "@/extensions/health_check/utils/shared/batchCache";
import { getModDetails } from "@/extensions/health_check/utils/shared/modDetails";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
  type IHealthCheck,
  type IHealthCheckResult,
} from "../../../types/IHealthCheck";
import { getGame, nexusGameId, renderModName } from "../../../util/api";
import { getSafe } from "../../../util/storeHelper";
import type { IMod } from "../../mod_management/types/IMod";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { numericGameIdToDomainName } from "../../nexus_integration/util";
import { makeModUID } from "../../nexus_integration/util/UIDs";
import { activeProfile } from "../../profile_management/selectors";
import { setHealthCheckRunning } from "../actions/session";
import { isModRequirementsEnabled } from "../selectors";
import type {
  IModFileInfo,
  IModRequirementsCheckMetadata,
  IModMissingRequirements,
  IModRequirementExt,
} from "../types";

export const MOD_REQUIREMENTS_CHECK_ID = "check-nexus-mod-requirements";

// Per-mod file-list lookups have no batch endpoint; fan them out this many at a time.
const FILE_LOOKUP_CONCURRENCY = 20;

// Mod requirements rarely change between runs; cache them in memory for a while
// so re-runs (e.g. on ModsChanged) refetch at most once per TTL and always
// refetch after a restart
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

const modRequirementsCache: KeyedCache<Partial<IModRequirements>> = createKeyedCache(CACHE_TTL_MS);

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
function buildDetailsString(modsWithIssues: IModMissingRequirements[], errors: string[]): string {
  const parts: string[] = [];

  const modsWithMissingMods = modsWithIssues.filter((m) => m.missingMods.length > 0);
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

  const modsWithDlc = modsWithIssues.filter((m) => m.dlcRequirements.length > 0);
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
 * Resolve a non-external requirement to its target mod id and Nexus domain, or
 * null when it has no usable Nexus mod id.
 */
function resolveRequirementTarget(
  req: { modId: string; gameId?: string | null },
  fallbackGameId: string,
): { requiredModId: number; domainName: string | undefined; gameIdForStorage: string } | null {
  const requiredModId = parseInt(req.modId, 10);
  if (isNaN(requiredModId) || requiredModId <= 0) {
    return null;
  }
  const requiredGameId = req.gameId ? parseInt(req.gameId, 10) : undefined;
  const domainName =
    requiredGameId != null ? numericGameIdToDomainName(requiredGameId) : fallbackGameId;
  return { requiredModId, domainName, gameIdForStorage: domainName ?? fallbackGameId };
}

/**
 * Resolve a mod's Nexus mod UID (the game id + game-scoped mod id composite)
 * Returns undefined when the mod has no usable Nexus mod id.
 */
function resolveModUID(mod: IMod, gameId: string): string | undefined {
  const modId = mod.attributes?.modId;
  if (modId === undefined) {
    return undefined;
  }
  return (
    makeModUID({
      gameId: mod.attributes?.downloadGame ?? gameId,
      modId: String(modId),
      fileId: "0",
    }) ?? undefined
  );
}

/**
 * Check Nexus mod requirements
 * Fetches requirements from Nexus API and checks if they are satisfied
 */
export async function checkModRequirements(api: IExtensionApi): Promise<IHealthCheckResult> {
  const startTime = Date.now();
  try {
    const state = api.getState();
    const profile = activeProfile(state);

    if (!profile) {
      return createResult(startTime, "passed", HealthCheckSeverity.Info, "No active profile");
    }

    const gameId = profile.gameId;
    if (!gameId) {
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

    const enabledMods = getEnabledMods(api, gameId).filter(
      (mod: IMod) =>
        mod.type !== "collection" &&
        !mod.attributes?.installedAsDependency &&
        mod.attributes?.modId &&
        mod.attributes?.source === "nexus",
    );

    if (enabledMods.length === 0) {
      return createResult(startTime, "passed", HealthCheckSeverity.Info, "No Nexus mods installed");
    }

    // Build lookup structures for O(1) access
    const installedModIds = new Set<number>();
    for (const mod of enabledMods) {
      const nexusModId = mod.attributes?.modId;
      if (nexusModId) {
        installedModIds.add(nexusModId);
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

    // Key the session cache by mod UID. Installed mods sharing uid resolve
    // to one UID and share a single cache entry.
    const modsByUid = new Map<string, IMod>();
    for (const mod of enabledMods) {
      const uid = resolveModUID(mod, gameId);
      if (uid) {
        modsByUid.set(uid, mod);
      }
    }

    const nexusGetModRequirements = api.ext.nexusGetModRequirements as
      | ((
          gameId: string,
          modIds: number[],
        ) => Promise<{ [modId: number]: Partial<IModRequirements> }>)
      | undefined;

    // Resolve requirements through the timed session cache, fetching only the
    // misses. resolveCached returns entries keyed by UID; re-key by mod id for
    // the rest of the check, which works in numeric mod ids.
    const requirementsMap: {
      [modId: number]: Partial<IModRequirements> | undefined;
    } = {};

    try {
      const resolved = await resolveCached(
        [...modsByUid.keys()],
        modRequirementsCache,
        async (missingUids): Promise<Map<string, Partial<IModRequirements>>> => {
          const byUid = new Map<string, Partial<IModRequirements>>();
          if (!nexusGetModRequirements) {
            throw new Error("Nexus API not available");
          }
          // The endpoint is game-scoped and keyed by numeric mod id, so group
          // the misses by each mod's own game (as their UIDs were), then map the
          // per-game response back onto the UID it came from.
          const missesByGame = new Map<string, Map<number, string>>();
          for (const uid of missingUids) {
            const attributes = modsByUid.get(uid)?.attributes;
            if (attributes?.modId === undefined) continue;
            const modGameId = attributes.downloadGame ?? gameId;
            const uidByModId = missesByGame.get(modGameId) ?? new Map<number, string>();
            uidByModId.set(attributes.modId, uid);
            missesByGame.set(modGameId, uidByModId);
          }

          for (const [modGameId, uidByModId] of missesByGame) {
            const fetched = await nexusGetModRequirements(modGameId, [...uidByModId.keys()]);
            for (const [modIdStr, requirements] of Object.entries(fetched ?? {})) {
              const uid = uidByModId.get(parseInt(modIdStr, 10));
              if (uid && requirements) {
                byUid.set(uid, requirements);
              }
            }
          }
          metadata.modsFetched += byUid.size;
          return byUid;
        },
      );

      for (const [uid, requirements] of resolved) {
        const modId = modsByUid.get(uid)?.attributes?.modId;
        if (modId !== undefined) {
          requirementsMap[modId] = requirements;
        }
      }
    } catch (err) {
      log("warn", "Failed to fetch mod requirements", {
        error: (err as Error).message,
      });
      metadata.errors.push(`Failed to fetch requirements: ${(err as Error).message}`);
    }

    // Pre-fetch, batched and in parallel, the per-required-mod data the second pass
    // needs: mod display details (one batched /mods/batch call, which also warms the
    // cache the file fetch reuses) and the file list for the "exactly one main file"
    // rule. Files have no batch endpoint, so fan out with a concurrency cap. The
    // second pass then reads both from cache instead of awaiting one mod at a time.
    const requiredTargets = new Map<number, { gameId: string; uid: string | undefined }>();
    for (const mod of enabledMods) {
      const requiringModId = mod.attributes?.modId;
      const sourceGameId = mod.attributes?.downloadGame;
      if (!requiringModId || !sourceGameId) {
        continue;
      }
      for (const req of requirementsMap[requiringModId]?.nexusRequirements?.nodes ?? []) {
        if (req.externalRequirement) {
          continue;
        }
        const target = resolveRequirementTarget(req, sourceGameId);
        if (!target || installedModIds.has(target.requiredModId)) {
          continue;
        }
        if (!requiredTargets.has(target.requiredModId)) {
          requiredTargets.set(target.requiredModId, {
            gameId: target.gameIdForStorage,
            uid: makeModUID({ modId: req.modId, fileId: "0", gameId: target.gameIdForStorage }),
          });
        }
      }
    }

    // One batched mod-details call instead of one per required mod.
    const detailUids = [...requiredTargets.values()]
      .map((target) => target.uid)
      .filter((uid): uid is string => !!uid);
    if (detailUids.length > 0) {
      try {
        await getModDetails(api, detailUids);
      } catch (err) {
        log("warn", "Failed to batch mod details", { error: (err as Error).message });
      }
    }

    // File-list lookups, fanned out in bounded-concurrency waves.
    const filesByRequiredModId = new Map<number, IModFileInfo[]>();
    for (const wave of chunked([...requiredTargets], FILE_LOOKUP_CONCURRENCY)) {
      const fetched = await Promise.all(
        wave.map(async ([requiredModId, target]) => {
          const files = await getModFilesWithCache(api, target.gameId, requiredModId).catch(
            (): IModFileInfo[] => [],
          );
          return [requiredModId, files] as const;
        }),
      );
      for (const [requiredModId, files] of fetched) {
        filesByRequiredModId.set(requiredModId, files);
      }
    }

    // Second pass: process requirements and check for missing dependencies
    for (const mod of enabledMods) {
      const modId = mod.attributes?.modId;
      if (!modId) continue;
      const gameId = mod.attributes.downloadGame;
      if (!gameId) continue;

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
        const requiredBy: IModRequirementExt["requiredBy"] = {
          modId,
          modName: getModName(),
          modUrl: requiringModNexusDomain
            ? `https://www.nexusmods.com/${requiringModNexusDomain}/mods/${modId}`
            : undefined,
        };

        for (const req of requirements.nexusRequirements.nodes) {
          // External requirements (e.g. tools from GitHub) don't have valid
          // Nexus mod IDs — report them as missing but skip the API lookup
          if (req.externalRequirement) {
            getModEntry().missingMods.push({
              ...req,
              modId: 0,
              gameId,
              uid: `external-${req.id}`,
              requiredBy,
              modUrl: req.url,
            });
            continue;
          }

          const target = resolveRequirementTarget(req, gameId);
          if (!target || installedModIds.has(target.requiredModId)) {
            continue;
          }
          const { requiredModId, domainName, gameIdForStorage } = target;

          // Only show items for mods with exactly one main file (pre-fetched above).
          const mainFiles = filesByRequiredModId.get(requiredModId) ?? [];
          if (mainFiles.length !== 1) {
            continue;
          }

          getModEntry().missingMods.push({
            ...req,
            modId: requiredModId,
            gameId: gameIdForStorage,
            uid: makeModUID({
              modId: req.modId,
              fileId: "0",
              gameId: gameIdForStorage,
            }),
            requiredBy,
            modUrl:
              (req.url && req.url.trim()) ||
              (domainName
                ? `https://www.nexusmods.com/${domainName}/mods/${requiredModId}`
                : undefined),
          });
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
    const totalMissingMods = modsWithIssues.reduce((sum, m) => sum + m.missingMods.length, 0);
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
    const severity = totalMissingMods > 0 ? HealthCheckSeverity.Warning : HealthCheckSeverity.Info;
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
}

/**
 * Registration descriptor for the Nexus mod requirements check. Owns its own
 * enablement gate and running-state bracket so that index.ts only has to
 * register it.
 */
export const modRequirementsHealthCheck: IHealthCheck = {
  id: MOD_REQUIREMENTS_CHECK_ID,
  name: "Nexus Mod Requirements",
  description: "Validates that all Nexus mod requirements are satisfied",
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
    if (!isModRequirementsEnabled(api.getState())) {
      return {
        checkId: MOD_REQUIREMENTS_CHECK_ID,
        status: "passed",
        severity: HealthCheckSeverity.Info,
        message: "Mod requirements check disabled",
        executionTime: 0,
        timestamp: new Date(),
      };
    }

    api.store?.dispatch(setHealthCheckRunning(MOD_REQUIREMENTS_CHECK_ID, true));
    try {
      return await checkModRequirements(api);
    } finally {
      api.store?.dispatch(setHealthCheckRunning(MOD_REQUIREMENTS_CHECK_ID, false));
    }
  },
};
