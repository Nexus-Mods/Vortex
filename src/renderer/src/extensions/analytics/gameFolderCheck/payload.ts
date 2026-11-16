import type { GameFolderFileCount, GameFolderStatePayload } from "@vortex/nexus-api-v3";
import type { NexusGameId } from "@vortex/shared";
import type { GameFolderCheckCounts, GameFolderCheckResult } from "@vortex/shared/ipc";

const iso = (ms: number | null | undefined): string | null =>
  ms === null || ms === undefined || !Number.isFinite(ms) ? null : new Date(ms).toISOString();

type GameFolderFile = GameFolderStatePayload["files"][number];
type GameFolderFolderCount = GameFolderStatePayload["unknown_by_folder"][number];

const zero = (): GameFolderFileCount => ({ files: 0, bytes: 0 });

const NO_COUNTS: GameFolderCheckCounts = {
  steamFiles: {
    verified: zero(),
    sizeMatched: zero(),
    modified: zero(),
    missing: zero(),
    unreadable: zero(),
    notCompared: zero(),
    unchecked: zero(),
  },
  modifiedBy: { size: 0, sampled_chunk: 0, full_hash: 0 },
  sampleMissed: null,
  fileSampleMissed: null,
  hashSample: { files: 0, capped: false },
  unknown: zero(),
  unknownInVortexFolder: zero(),
  vortex: zero(),
  vortexChangedSinceDeploy: zero(),
};

export interface IPayloadContext {
  nexusGameId: NexusGameId;
  managedAt: number;
  /** Steam's LastUpdated from the ACF */
  steamLastUpdated: number | null;
}

/**
 * The API rejects an event whose payload is over 64 KiB; this leaves room under it. Only the file
 * lists are trimmed to fit, never the counts.
 */
export const MAX_PAYLOAD_BYTES = 60 * 1024;

export function toGameFolderStatePayload(
  result: GameFolderCheckResult,
  context: IPayloadContext,
  random: () => number = Math.random,
): GameFolderStatePayload {
  return fitPayload(buildPayload(result, context), MAX_PAYLOAD_BYTES, random);
}

function buildPayload(
  result: GameFolderCheckResult,
  context: IPayloadContext,
): GameFolderStatePayload {
  const checked = result.status === "checked" ? result : undefined;
  const counts = checked?.counts ?? NO_COUNTS;
  const { steamFiles } = counts;
  return {
    game_id: String(context.nexusGameId),
    status: result.status,
    reason: result.status === "checked" ? null : result.reason,
    verification: checked?.verification ?? null,
    deployed_before_check: checked?.deployedBeforeCheck ?? false,
    full_verify: result.input.fullVerify,
    steam: {
      app_id: result.input.appId,
      build_id: result.input.buildId,
      depots: result.input.depots.map(({ depotId, manifestId }) => ({
        depot_id: depotId,
        manifest_id: manifestId,
        manifest_created_at: iso(result.manifestCreatedAt[`${depotId}_${manifestId}`]),
      })),
    },
    managed_at: iso(context.managedAt) ?? new Date(0).toISOString(),
    steam_last_updated: iso(context.steamLastUpdated),
    folder_created_at: iso(result.folderCreatedAt),
    steam_files: {
      verified: steamFiles.verified,
      size_matched: steamFiles.sizeMatched,
      modified: steamFiles.modified,
      missing: steamFiles.missing,
      unreadable: steamFiles.unreadable,
      not_compared: steamFiles.notCompared,
      unchecked: steamFiles.unchecked,
    },
    modified_by: counts.modifiedBy,
    sample_missed: counts.sampleMissed,
    file_sample_missed: counts.fileSampleMissed,
    hashed_sample: counts.hashSample,
    unknown: counts.unknown,
    unknown_in_vortex_folder: counts.unknownInVortexFolder,
    vortex: counts.vortex,
    vortex_changed_since_deploy: counts.vortexChangedSinceDeploy,
    files: (checked?.files ?? []).map((file) => ({
      path: file.path,
      status: file.status,
      ...(file.detectedBy !== undefined && { detected_by: file.detectedBy }),
      ...(file.fromBackup === true && { from_backup: true as const }),
      ...(file.inVortexFolder === true && { in_vortex_folder: true as const }),
    })),
    files_truncated: false,
    unknown_truncated: checked?.unknownTruncated ?? false,
    unknown_by_folder: checked?.unknownByFolder ?? [],
    unknown_by_folder_truncated: false,
    cost: {
      duration_ms: result.cost.durationMs,
      files_walked: result.cost.filesWalked,
      bytes_read: result.cost.bytesRead,
    },
  };
}

const encoder = new TextEncoder();
const jsonBytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;

/**
 * Trims the file lists until the payload fits in `maxBytes`, filling them in order of value:
 * modified and missing files, then the unknown-file folder totals (largest first), then a random
 * sample of the unknown files.
 */
export function fitPayload(
  payload: GameFolderStatePayload,
  maxBytes: number,
  random: () => number,
): GameFolderStatePayload {
  if (jsonBytes(payload) <= maxBytes) return payload;

  const empty = { ...payload, files: [], unknown_by_folder: [] };
  // "true" is one byte shorter than "false", so the flags the trim may set can't push it over
  let budget = maxBytes - jsonBytes(empty);
  // an entry costs its own JSON plus the comma before it; counting the comma on the first entry too
  // keeps the total on the safe side
  const take = <T>(entries: readonly T[]): T[] => {
    const kept: T[] = [];
    for (const entry of entries) {
      const cost = jsonBytes(entry) + 1;
      if (cost > budget) break;
      budget -= cost;
      kept.push(entry);
    }
    return kept;
  };

  const steamFiles = payload.files.filter((file) => file.status !== "unknown");
  const unknownFiles = payload.files.filter((file) => file.status === "unknown");

  const keptSteamFiles = take(steamFiles);
  const keptFolders = take(
    payload.unknown_by_folder.toSorted(
      (lhs: GameFolderFolderCount, rhs: GameFolderFolderCount) => rhs.files - lhs.files,
    ),
  );
  // the unknown files arrive sorted, so cutting the list short would keep only the first folders
  // alphabetically; take a fresh random sample instead and sort it again
  const keptUnknown = take(shuffled(unknownFiles, random)).toSorted(byPath);

  return {
    ...payload,
    files: [...keptSteamFiles, ...keptUnknown],
    files_truncated: keptSteamFiles.length < steamFiles.length,
    unknown_truncated: payload.unknown_truncated || keptUnknown.length < unknownFiles.length,
    unknown_by_folder: keptFolders,
    unknown_by_folder_truncated: keptFolders.length < payload.unknown_by_folder.length,
  };
}

function shuffled<T>(entries: readonly T[], random: () => number): T[] {
  const copy = [...entries];
  for (let index = copy.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick]!, copy[index]!];
  }
  return copy;
}

const byPath = (lhs: GameFolderFile, rhs: GameFolderFile): number =>
  lhs.path < rhs.path ? -1 : lhs.path > rhs.path ? 1 : 0;
