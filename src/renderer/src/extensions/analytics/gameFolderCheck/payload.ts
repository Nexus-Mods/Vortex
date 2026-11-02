import type { GameFolderFileCount, GameFolderStatePayload } from "@vortex/nexus-api-v3";
import type { GameId } from "@vortex/shared";
import type { GameFolderCheckCounts, GameFolderCheckResult } from "@vortex/shared/ipc";

const iso = (ms: number | null | undefined): string | null =>
  ms === null || ms === undefined || !Number.isFinite(ms) ? null : new Date(ms).toISOString();

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
  vortex: zero(),
  vortexChangedSinceDeploy: zero(),
};

export interface IPayloadContext {
  nexusGameId: GameId;
  managedAt: number;
  /** Steam's LastUpdated from the ACF */
  steamLastUpdated: number | null;
}

export function toGameFolderStatePayload(
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
    vortex: counts.vortex,
    vortex_changed_since_deploy: counts.vortexChangedSinceDeploy,
    files: (checked?.files ?? []).map((file) => ({
      path: file.path,
      status: file.status,
      ...(file.detectedBy !== undefined && { detected_by: file.detectedBy }),
      ...(file.fromBackup === true && { from_backup: true as const }),
    })),
    unknown_truncated: checked?.unknownTruncated ?? false,
    unknown_by_folder: checked?.unknownByFolder ?? [],
    cost: {
      duration_ms: result.cost.durationMs,
      files_walked: result.cost.filesWalked,
      bytes_read: result.cost.bytesRead,
    },
  };
}
