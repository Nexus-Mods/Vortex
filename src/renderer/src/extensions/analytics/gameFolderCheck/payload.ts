import type {
  GameFolderFile,
  GameFolderFileCount,
  GameFolderFolderCount,
  GameFolderStateFilesPayload,
  GameFolderStatePayload,
} from "@vortex/nexus-api-v3";
import type { NexusGameId } from "@vortex/shared";
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
  unknownInVortexFolder: zero(),
  vortex: zero(),
  vortexChangedSinceDeploy: zero(),
};

export interface IPayloadContext {
  nexusGameId: NexusGameId;
  managedAt: number;
  /** Steam's LastUpdated from the ACF */
  steamLastUpdated: number | null;
  /** ties the state event to its file events */
  checkId: string;
  /** file events the check may send; 0 sends no paths */
  maxFileParts: number;
  /** the most bytes one event's payload may take */
  maxEventBytes: number;
}

/** One check as it is sent: the state event's payload and those of its file events. */
export interface IGameFolderStateEvents {
  state: GameFolderStatePayload;
  fileParts: GameFolderStateFilesPayload[];
}

/**
 * Maps a finished check to its events. The paths go in the file events, filled in order of
 * value: modified and missing files, then unknown files. When they don't all fit in
 * `maxFileParts` events of `maxEventBytes` each, the unknown files that do go are a random
 * sample. Only the lists are cut to fit, never the counts.
 */
export function toGameFolderStateEvents(
  result: GameFolderCheckResult,
  context: IPayloadContext,
  random: () => number = Math.random,
): IGameFolderStateEvents {
  const gameId = String(context.nexusGameId);
  const filesPayload = (part: number, parts: number, files: GameFolderFile[]) => ({
    check_id: context.checkId,
    game_id: gameId,
    part,
    parts,
    files,
  });

  const files = result.status === "checked" ? result.files.map(toFile) : [];
  const steamFiles = files.filter((file) => file.status !== "unknown");
  const unknownFiles = files.filter((file) => file.status === "unknown");

  const maxParts = context.maxFileParts;
  // what one file event holds besides its fixed fields, sized for the widest part numbers
  const room = context.maxEventBytes - jsonBytes(filesPayload(maxParts, maxParts, []));
  let parts = pack([...steamFiles, ...unknownFiles], room, maxParts);
  if (unknownFiles.length > 0 && parts.flat().length < files.length) {
    // the unknown files arrive sorted, so cutting the list short would keep only the first folders
    // alphabetically; take a random sample instead and sort it again
    const sample = pack([...steamFiles, ...shuffled(unknownFiles, random)], room, maxParts)
      .flat()
      .filter((file) => file.status === "unknown")
      .toSorted(byPath);
    parts = pack([...steamFiles, ...sample], room, maxParts);
  }
  const sent = parts.flat();
  const sentSteamFiles = sent.filter((file) => file.status !== "unknown").length;

  const state = buildPayload(result, context);
  return {
    state: fitState(context.maxEventBytes, {
      ...state,
      file_parts: parts.length,
      files_truncated: sentSteamFiles < steamFiles.length,
      unknown_truncated:
        state.unknown_truncated || sent.length - sentSteamFiles < unknownFiles.length,
    }),
    fileParts: parts.map((part, index) => filesPayload(index + 1, parts.length, part)),
  };
}

const toFile = (
  file: Extract<GameFolderCheckResult, { status: "checked" }>["files"][number],
): GameFolderFile => ({
  path: file.path,
  status: file.status,
  ...(file.detectedBy !== undefined && { detected_by: file.detectedBy }),
  ...(file.fromBackup === true && { from_backup: true as const }),
  ...(file.inVortexFolder === true && { in_vortex_folder: true as const }),
});

function buildPayload(
  result: GameFolderCheckResult,
  context: IPayloadContext,
): GameFolderStatePayload {
  const checked = result.status === "checked" ? result : undefined;
  const counts = checked?.counts ?? NO_COUNTS;
  const { steamFiles } = counts;
  return {
    check_id: context.checkId,
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
    file_parts: 0,
    max_file_parts: context.maxFileParts,
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
 * Groups events, in order, into batches whose payloads total at most `maxBytes`. An event over
 * that on its own gets a batch to itself.
 */
export function toBatches<T extends { payload: unknown }>(
  events: readonly T[],
  maxBytes: number,
): T[][] {
  const batches: T[][] = [];
  let used = 0;
  for (const event of events) {
    const size = jsonBytes(event.payload);
    if (batches.length === 0 || used + size > maxBytes) {
      batches.push([]);
      used = 0;
    }
    batches.at(-1)!.push(event);
    used += size;
  }
  return batches;
}

// an entry costs its own JSON plus the comma before it; counting the comma on the first entry too
// keeps the total on the safe side
const entryBytes = (entry: unknown): number => jsonBytes(entry) + 1;

/**
 * Splits the entries, in order, into up to `maxParts` lists of at most `room` bytes each, and
 * stops at the first entry that no longer fits.
 */
function pack<T>(entries: readonly T[], room: number, maxParts: number): T[][] {
  const parts: T[][] = [];
  let left = 0;
  for (const entry of entries) {
    const cost = entryBytes(entry);
    // too big for any event, so it can't hold up the entries behind it
    if (cost > room) continue;
    if (cost > left) {
      if (parts.length >= maxParts) break;
      parts.push([]);
      left = room;
    }
    parts.at(-1)!.push(entry);
    left -= cost;
  }
  return parts;
}

/** Cuts the unknown-file folder totals, smallest first, until the state event fits its limit. */
function fitState(maxBytes: number, payload: GameFolderStatePayload): GameFolderStatePayload {
  if (jsonBytes(payload) <= maxBytes) return payload;

  // "true" is one byte shorter than "false", so setting the flag can't push it over
  let budget = maxBytes - jsonBytes({ ...payload, unknown_by_folder: [] });
  const kept: GameFolderFolderCount[] = [];
  const largestFirst = payload.unknown_by_folder.toSorted(
    (lhs: GameFolderFolderCount, rhs: GameFolderFolderCount) => rhs.files - lhs.files,
  );
  for (const folder of largestFirst) {
    const cost = entryBytes(folder);
    if (cost > budget) break;
    budget -= cost;
    kept.push(folder);
  }
  return {
    ...payload,
    unknown_by_folder: kept,
    unknown_by_folder_truncated: kept.length < payload.unknown_by_folder.length,
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
