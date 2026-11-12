import type { GameFolderCheckFlagConfig } from "@vortex/shared/flags";
import type { GameFolderCheckLimits } from "@vortex/shared/ipc";

import { FlagService } from "@/FlagService";

export const GAME_FOLDER_CHECK_FLAG = "vortex-game-folder-check";

export interface IGameFolderCheckConfig {
  /** wait after the game is managed before checking */
  settleMs: number;
  limits: GameFolderCheckLimits;
  /** share of checks that hash every chunk of every Steam file */
  fullVerifyPercent: number;
}

export function gameFolderCheckConfig(
  overrides: GameFolderCheckFlagConfig = {},
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
  };
}

/** The flag's configuration, or undefined while the flag is off. */
export function flaggedGameFolderCheckConfig(): IGameFolderCheckConfig | undefined {
  const flag = FlagService.instance?.getFlag(GAME_FOLDER_CHECK_FLAG);
  if (flag === undefined) return undefined;
  return gameFolderCheckConfig(flag.variant?.name === "config" ? flag.variant.data : {});
}
