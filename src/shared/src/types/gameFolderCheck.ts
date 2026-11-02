import type { VortexGameId } from "./ids";

/** Limits for one game folder check; going over aborts the part that hit it. */
export interface GameFolderCheckLimits {
  maxDurationMs: number;
  maxBytes: number;
  /** Steam files hashed at the same time */
  hashConcurrency: number;
  /** same-size executables (.exe, .dll) hashed per check */
  hashSampleExecutables: number;
  /** same-size other files hashed per check */
  hashSampleFiles: number;
  /** unknown paths sent per check; modified and missing paths are always sent in full */
  maxUnknownPaths: number;
}

/** Everything main needs to check one Steam game folder, from the renderer's Steam scan. */
export interface GameFolderCheckInput {
  gameId: VortexGameId;
  appId: number;
  buildId: number;
  targetBuildId: number;
  /** Steam's install folder, holding `depotcache` */
  steamPath: string;
  gamePath: string;
  /** Installed depots from the ACF, shared redistributable depots excluded */
  depots: Array<{ depotId: number; manifestId: string }>;
  /** Hash every chunk of every Steam file, and record what sampling alone would have found */
  fullVerify: boolean;
  limits: GameFolderCheckLimits;
}

export interface GameFolderFileCount {
  files: number;
  bytes: number;
}

export type GameFolderPartStatus =
  | { status: "checked"; reason: null }
  | { status: "aborted"; reason: string };

export type GameFolderDetection = "size" | "sampled_chunk" | "full_hash";

export interface GameFolderSteamFiles {
  /** hashed and matched */
  verified: GameFolderFileCount;
  /** same size as Steam's, not picked for hashing */
  sizeMatched: GameFolderFileCount;
  modified: GameFolderFileCount;
  missing: GameFolderFileCount;
  /** on disk, but couldn't be read */
  unreadable: GameFolderFileCount;
  /** user config and symlinks, which Steam's own verify doesn't restore either */
  notCompared: GameFolderFileCount;
  /** not reached before the check stopped */
  unchecked: GameFolderFileCount;
}

export interface GameFolderCheckCounts {
  steamFiles: GameFolderSteamFiles;
  modifiedBy: Record<GameFolderDetection, number>;
  /** with fullVerify: modified files the chunk sample alone would have missed */
  sampleMissed: number | null;
  /** with fullVerify: modified files the file sample wouldn't have picked */
  fileSampleMissed: number | null;
  /** files picked for hashing; capped when there were more same-size files than the samples take */
  hashSample: { files: number; capped: boolean };
  unknown: GameFolderFileCount;
  vortex: GameFolderFileCount;
  vortexChangedSinceDeploy: GameFolderFileCount;
}

export interface GameFolderCheckCost {
  durationMs: number;
  filesWalked: number;
  bytesRead: number;
}

export type GameFolderCheckOutcome =
  | { status: "no_baseline"; reason: string }
  | { status: "aborted"; reason: string }
  | {
      status: "checked";
      verification: GameFolderPartStatus;
      counts: GameFolderCheckCounts;
      deployedBeforeCheck: boolean;
      files: GameFolderReportedFile[];
      /** more unknown files than `maxUnknownPaths`; `unknownByFolder` still covers them all */
      unknownTruncated: boolean;
      unknownByFolder: GameFolderFolderCount[];
    };

/** A file sent with the check; paths are relative to the game folder, with `/` separators. */
export interface GameFolderReportedFile {
  path: string;
  status: "modified" | "missing" | "unknown";
  detectedBy?: GameFolderDetection;
  /** the original was the `.vortex_backup` Vortex made when it deployed over the file */
  fromBackup?: true;
}

/** Unknown files totalled by their first two folders */
export interface GameFolderFolderCount {
  folder: string;
  files: number;
  bytes: number;
}

/** A finished check, as main hands it to the renderer to send. Times are ms since the epoch. */
export type GameFolderCheckResult = GameFolderCheckOutcome & {
  input: GameFolderCheckInput;
  folderCreatedAt: number | null;
  manifestCreatedAt: Record<string, number | null>;
  cost: GameFolderCheckCost;
};

export type GameFolderFileKind =
  | "verified"
  | "size_matched"
  | "modified"
  | "missing"
  | "unreadable"
  | "not_compared"
  | "unchecked"
  | "unknown"
  | "vortex";

/** One file in a dev-build report; these never leave the machine. */
export interface GameFolderFileReport {
  relPath: string;
  kind: GameFolderFileKind;
  size: number;
  detectedBy?: GameFolderDetection;
  fromBackup?: boolean;
  changedSinceDeploy?: boolean;
}
