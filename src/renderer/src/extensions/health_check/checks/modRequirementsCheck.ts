import type { IModRequirements } from "@nexusmods/nexus-api";
/**
 * Mod Requirements Health Check
 * Validates that all Nexus mod requirements are satisfied
 */
import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";

import { getGame } from "@/extensions/gamemode_management/util/getGame";
import { getModFilesWithCache } from "@/extensions/health_check/utils/modRequirements/modFiles";
import { chunked, resolveCached } from "@/extensions/health_check/utils/shared/batchCache";
import {
  collectionManagedTags,
  isCollectionManaged,
} from "@/extensions/health_check/utils/shared/collectionManaged";
import { getModDetails } from "@/extensions/health_check/utils/shared/modDetails";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import renderModName from "@/extensions/mod_management/util/modName";
import { isLoggedIn } from "@/extensions/nexus_integration/selectors";
import { nexusGamesProm, numericGameIdToDomainName } from "@/extensions/nexus_integration/util";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import { makeModUID, VORTEX_MOD_UID } from "@/extensions/nexus_integration/util/UIDs";
import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IProfile } from "@/extensions/profile_management/types/IProfile";
import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";
import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
  type IHealthCheck,
  type IHealthCheckResult,
} from "@/types/IHealthCheck";
import { createKeyedCache, type KeyedCache } from "@/util/keyedCache";
import { getSafe } from "@/util/storeHelper";

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
 * Resolve a non-external requirement to its target mod id, Nexus domain, and UID,
 * or null when it has no usable Nexus mod id, or when it targets the Vortex mod page
 * itself (always considered satisfied, with no version to check).
 */
export function resolveRequirementTarget(
  req: { modId: string; gameId?: string | null },
  fallbackGameId: string,
): {
  requiredModId: number;
  domainName: string | undefined;
  gameIdForStorage: string;
  uid: string | undefined;
} | null {
  const requiredModId = parseInt(req.modId, 10);
  if (isNaN(requiredModId) || requiredModId <= 0) {
    return null;
  }
  const requiredGameId = req.gameId ? parseInt(req.gameId, 10) : undefined;
  const domainName =
    requiredGameId != null ? numericGameIdToDomainName(requiredGameId) : fallbackGameId;
  const gameIdForStorage = domainName ?? fallbackGameId;
  const uid = makeModUID({ modId: req.modId, fileId: "0", gameId: gameIdForStorage });

  // Filter out requirements that target Vortex itself, treat as always satisfied.
  if (uid === VORTEX_MOD_UID) {
    return null;
  }

  return {
    requiredModId,
    domainName,
    gameIdForStorage,
    uid,
  };
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
 * Splits the profile's enabled Nexus mods into `checkedModsByUid` (mods to check against
 * their own Nexus-declared requirements) and `installedModUids` (mods that count as
 * installed when checking whether some other mod's requirement is satisfied).
 * Collection-managed mods are excluded from the former but included in the latter.
 */
export function partitionNexusMods(
  enabledMods: IMod[],
  mods: { [modId: string]: IMod },
  profile: IProfile,
  gameId: string,
): { checkedModsByUid: Map<string, IMod>; installedModUids: Set<string> } {
  const nexusMods = enabledMods.filter(
    (mod) =>
      mod.type !== "collection" && mod.attributes?.modId && mod.attributes?.source === "nexus",
  );

  const collectionTags = collectionManagedTags(mods, profile);

  const uidByModId = new Map<string, string>();
  const installedModUids = new Set<string>();
  for (const mod of nexusMods) {
    const uid = resolveModUID(mod, gameId);
    if (uid) {
      uidByModId.set(mod.id, uid);
      installedModUids.add(uid);
    }
  }

  const checkedModsByUid = new Map<string, IMod>();
  for (const mod of nexusMods) {
    if (isCollectionManaged(mod, collectionTags)) continue;
    const uid = uidByModId.get(mod.id);
    if (uid) {
      checkedModsByUid.set(uid, mod);
    }
  }

  return { checkedModsByUid, installedModUids };
}

/**
 * Check Nexus mod requirements
 * Fetches requirements from Nexus API and checks if they are satisfied
 */
export async function checkModRequirements(
  api: IExtensionApi,
  signal?: AbortSignal,
): Promise<IHealthCheckResult> {
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

    const mods = state.persistent.mods[gameId] ?? {};

    // makeModUID needs the nexus games list to map a game domain to its numeric id;
    // ensure it is loaded before building any UIDs (GH#22466).
    await nexusGamesProm();

    const { checkedModsByUid, installedModUids } = partitionNexusMods(
      getEnabledMods(api, gameId),
      mods,
      profile,
      gameId,
    );

    if (installedModUids.size === 0) {
      return createResult(startTime, "passed", HealthCheckSeverity.Info, "No Nexus mods installed");
    }

    // Build typed metadata for the result
    const metadata: IModRequirementsCheckMetadata = {
      gameId,
      modsChecked: 0,
      modsFetched: 0,
      modRequirements: {},
      errors: [],
    };

    const nexusGetModRequirements = api.ext.nexusGetModRequirements as
      | ((uids: string[]) => Promise<{ [uid: string]: Partial<IModRequirements> }>)
      | undefined;

    // Resolve requirements through the timed session cache, fetching only the misses.
    const requirementsMap: {
      [uid: string]: Partial<IModRequirements> | undefined;
    } = {};

    signal?.throwIfAborted();

    try {
      const resolved = await resolveCached(
        [...checkedModsByUid.keys()],
        modRequirementsCache,
        async (missingUids): Promise<Map<string, Partial<IModRequirements>>> => {
          if (!nexusGetModRequirements) {
            throw new Error("Nexus API not available");
          }
          const fetched = await nexusGetModRequirements(missingUids);
          const byUid = new Map<string, Partial<IModRequirements>>(Object.entries(fetched ?? {}));
          metadata.modsFetched += byUid.size;
          return byUid;
        },
      );

      for (const [uid, requirements] of resolved) {
        requirementsMap[uid] = requirements;
      }
    } catch (err) {
      // Whatever the cache already held is still used below; the run is just incomplete,
      // which the result status reflects rather than reporting a clean pass.
      const message = getErrorMessageOrDefault(err);
      log("warn", "Failed to fetch mod requirements", { error: message });
      metadata.errors.push(`Failed to fetch requirements: ${message}`);
    }

    // Pre-fetch, batched and in parallel, the per-required-mod data the second pass
    // needs: mod display details (one batched /mods/batch call, which also warms the
    // cache the file fetch reuses) and the file list for the "exactly one main file"
    // rule. Files have no batch endpoint, so fan out with a concurrency cap. The
    // second pass then reads both from cache instead of awaiting one mod at a time.
    // Keyed by the required mod's UID so cross-game mods sharing a numeric id stay distinct.
    const requiredTargets = new Map<string, { gameId: string; modId: number }>();
    for (const [requiringUid, mod] of checkedModsByUid) {
      const sourceGameId = mod.attributes?.downloadGame;
      if (!sourceGameId) {
        continue;
      }
      for (const req of requirementsMap[requiringUid]?.nexusRequirements?.nodes ?? []) {
        if (req.externalRequirement) {
          continue;
        }
        const target = resolveRequirementTarget(req, sourceGameId);
        if (!target || !target.uid || installedModUids.has(target.uid)) {
          continue;
        }
        if (!requiredTargets.has(target.uid)) {
          requiredTargets.set(target.uid, {
            gameId: target.gameIdForStorage,
            modId: target.requiredModId,
          });
        }
      }
    }

    // One batched mod-details call instead of one per required mod.
    const detailUids = [...requiredTargets.keys()];
    if (detailUids.length > 0) {
      signal?.throwIfAborted();
      try {
        await getModDetails(api, detailUids, signal);
      } catch (err) {
        signal?.throwIfAborted();
        log("warn", "Failed to batch mod details", { error: getErrorMessageOrDefault(err) });
      }
    }

    // File-list lookups, fanned out in bounded-concurrency waves.
    const filesByRequiredUid = new Map<string, IModFileInfo[]>();
    for (const wave of chunked([...requiredTargets], FILE_LOOKUP_CONCURRENCY)) {
      signal?.throwIfAborted();
      const fetched = await Promise.all(
        wave.map(async ([uid, target]) => {
          const files = await getModFilesWithCache(api, target.gameId, target.modId).catch(
            (): IModFileInfo[] => [],
          );
          return [uid, files] as const;
        }),
      );
      for (const [uid, files] of fetched) {
        filesByRequiredUid.set(uid, files);
      }
    }

    // Second pass: process requirements and check for missing dependencies
    for (const [uid, mod] of checkedModsByUid) {
      const modId = mod.attributes?.modId;
      if (!modId) continue;
      const gameId = mod.attributes.downloadGame;
      if (!gameId) continue;

      // Get Nexus domain name for the requiring mod
      const game = getGame(gameId);
      const requiringModNexusDomain = game ? nexusGameId(game, gameId) : gameId;

      const requirements = requirementsMap[uid];
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
        const { nodes, totalCount } = requirements.nexusRequirements;
        if (totalCount > nodes.length) {
          log("debug", "mod requirements truncated by the query page size", {
            uid,
            fetched: nodes.length,
            totalCount,
          });
        }

        const requiredBy: IModRequirementExt["requiredBy"] = {
          modId,
          modName: getModName(),
          modUrl: requiringModNexusDomain
            ? `https://www.nexusmods.com/${requiringModNexusDomain}/mods/${modId}`
            : undefined,
        };

        for (const req of nodes) {
          // External (non-Nexus) requirements are temporarily suppressed because there
          // is no way to invalidate them. They can't be auto-detected, so the only way
          // to clear one is for the user to confirm it's installed — which just hides
          // it permanently, with no path back if they later uninstall it. Skip them
          // until that lifecycle is handled. Restore the push below (see git history /
          // commit 015dfa493) to re-enable the "External mod install" listing + detail
          // UI, which is left in place for that.
          if (req.externalRequirement) {
            continue;
          }

          const target = resolveRequirementTarget(req, gameId);
          if (!target || !target.uid || installedModUids.has(target.uid)) {
            continue;
          }
          const { requiredModId, domainName, gameIdForStorage, uid: requiredUid } = target;

          // Only show items for mods with exactly one main file (pre-fetched above).
          const mainFiles = filesByRequiredUid.get(requiredUid) ?? [];
          if (mainFiles.length !== 1) {
            continue;
          }

          getModEntry().missingMods.push({
            ...req,
            modId: requiredModId,
            gameId: gameIdForStorage,
            uid: requiredUid,
            // Denormalized for the detail view; see IModRequirementExt.mainFile.
            mainFile: mainFiles[0],
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

    const modEntries = Object.values(metadata.modRequirements);
    const details = buildDetailsString(modEntries, metadata.errors);

    // DLC requirements are collected into the metadata and the details, but no UI renders
    // them yet, so counting them would report issues against a visibly empty page.
    const modsWithMissing = modEntries.filter((mod) => mod.missingMods.length > 0);
    const totalMissingMods = modsWithMissing.reduce((sum, mod) => sum + mod.missingMods.length, 0);

    // An incomplete run cannot claim the loadout is fine: with the fetch failed we don't
    // know what we didn't see. Whatever was resolved from cache is still reported, so the
    // metadata rides along and the listing keeps showing it.
    if (metadata.errors.length > 0) {
      return createResult(
        startTime,
        "error",
        HealthCheckSeverity.Error,
        `Nexus mod requirements check incomplete: ${metadata.errors.length} fetch error(s), ${totalMissingMods} issues found in ${metadata.modsChecked} mods checked`,
        { details, metadata },
      );
    }

    if (totalMissingMods === 0) {
      return createResult(
        startTime,
        "passed",
        HealthCheckSeverity.Info,
        `All Nexus mod requirements satisfied (checked ${metadata.modsChecked} mods)`,
        { metadata },
      );
    }

    return createResult(
      startTime,
      "warning",
      HealthCheckSeverity.Warning,
      `Found ${totalMissingMods} requirement issues across ${modsWithMissing.length} mods`,
      { details, metadata },
    );
  } catch (error) {
    // The registry reports the timeout itself and discards this run's result.
    if (signal?.aborted) {
      throw error;
    }
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
    HealthCheckTrigger.LoginChanged,
  ],
  check: async (api: IExtensionApi, signal?: AbortSignal): Promise<IHealthCheckResult> => {
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
      return await checkModRequirements(api, signal);
    } finally {
      api.store?.dispatch(setHealthCheckRunning(MOD_REQUIREMENTS_CHECK_ID, false));
    }
  },
};
