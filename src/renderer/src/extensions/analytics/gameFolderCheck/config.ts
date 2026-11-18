import type { IGameFolderCheckFlagConfig } from "@vortex/shared/flags";
import type { IGameFolderCheckLimits } from "@vortex/shared/ipc";

import { FlagService } from "@/FlagService";

export const GAME_FOLDER_CHECK_FLAG = "vortex-game-folder-check";

export interface IGameFolderCheckConfig {
  /** wait after the game is managed before checking */
  settleMs: number;
  limits: IGameFolderCheckLimits;
  /** share of checks that hash every chunk of every Steam file */
  fullVerifyPercent: number;
  /** file events sent per check, each holding as many paths as fit in one; 0 sends no paths */
  maxFileParts: number;
  /** the most bytes one event's payload may take; the lists are cut to fit, never the counts */
  maxEventBytes: number;
}

/** The API rejects an event whose payload is over 64 KB; this leaves room under it. */
const DEFAULT_MAX_EVENT_BYTES = 60 * 1024;
/**
 * The API drops a batch whose payloads total over 256 KB; this leaves room under it. A check with
 * more events than fit is sent as several batches.
 */
export const MAX_BATCH_BYTES = 240 * 1024;
/** Enough for 2000 long paths at the default event size. */
const DEFAULT_MAX_FILE_PARTS = 6;
/** Keeps a mistaken flag value from turning one check into a long run of requests. */
const FILE_PARTS_CEILING = 20;

export function gameFolderCheckConfig(
  overrides: IGameFolderCheckFlagConfig = {},
): IGameFolderCheckConfig {
  return {
    settleMs: overrides.settleMs ?? 30_000,
    limits: {
      maxDurationMs: overrides.maxDurationMs ?? 60_000,
      maxBytes: overrides.maxBytes ?? 3 * 1024 ** 3,
      hashConcurrency: overrides.hashConcurrency ?? 4,
      hashSampleExecutables: overrides.hashSampleExecutables ?? 1_000,
      hashSampleFiles: overrides.hashSampleFiles ?? 2_000,
      maxUnknownPaths: overrides.maxUnknownPaths ?? 2_000,
    },
    fullVerifyPercent: overrides.fullVerifyPercent ?? 2,
    maxFileParts: Math.min(overrides.maxFileParts ?? DEFAULT_MAX_FILE_PARTS, FILE_PARTS_CEILING),
    maxEventBytes: overrides.maxEventBytes ?? DEFAULT_MAX_EVENT_BYTES,
  };
}

/** The flag's configuration, or undefined while the flag is off. */
export function flaggedGameFolderCheckConfig(): IGameFolderCheckConfig | undefined {
  const flag = FlagService.instance?.getFlag(GAME_FOLDER_CHECK_FLAG);
  if (flag === undefined) return undefined;
  return gameFolderCheckConfig(flag.variant?.name === "config" ? flag.variant.data : {});
}
