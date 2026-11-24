import type { VortexGameId } from "./ids";

/** Limits for one game folder check; going over aborts the part that hit it. */
export interface IGameFolderCheckLimits {
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
export interface IGameFolderCheckInput {
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
  limits: IGameFolderCheckLimits;
}

export interface IGameFolderFileCount {
  files: number;
  bytes: number;
}

export type GameFolderPartStatus =
  | { status: "checked"; reason: null }
  | { status: "aborted"; reason: string };

export type GameFolderDetection = "size" | "sampled_chunk" | "full_hash";

export interface IGameFolderSteamFiles {
  /** hashed and matched */
  verified: IGameFolderFileCount;
  /** same size as Steam's, not picked for hashing */
  sizeMatched: IGameFolderFileCount;
  modified: IGameFolderFileCount;
  missing: IGameFolderFileCount;
  /** on disk, but couldn't be read */
  unreadable: IGameFolderFileCount;
  /** user config and symlinks, which Steam's own verify doesn't restore either */
  notCompared: IGameFolderFileCount;
  /** not reached before the check stopped */
  unchecked: IGameFolderFileCount;
}

export interface IGameFolderCheckCounts {
  steamFiles: IGameFolderSteamFiles;
  modifiedBy: Record<GameFolderDetection, number>;
  /** with fullVerify: modified files the chunk sample alone would have missed */
  sampleMissed: number | null;
  /** with fullVerify: modified files the file sample wouldn't have picked */
  fileSampleMissed: number | null;
  /** files picked for hashing; capped when there were more same-size files than the samples take */
  hashSample: { files: number; capped: boolean };
  unknown: IGameFolderFileCount;
  /** unknown files in a folder Vortex created (holding a folder marker), or below one */
  unknownInVortexFolder: IGameFolderFileCount;
  vortex: IGameFolderFileCount;
  vortexChangedSinceDeploy: IGameFolderFileCount;
}

export interface IGameFolderCheckCost {
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
      counts: IGameFolderCheckCounts;
      deployedBeforeCheck: boolean;
      files: IGameFolderReportedFile[];
      /** more unknown files than `maxUnknownPaths`; `unknownByFolder` still covers them all */
      unknownTruncated: boolean;
      unknownByFolder: IGameFolderFolderCount[];
    };

/** A file sent with the check; paths are relative to the game folder, with `/` separators. */
export interface IGameFolderReportedFile {
  path: string;
  status: "modified" | "missing" | "unknown";
  detectedBy?: GameFolderDetection;
  /** the original was the `.vortex_backup` Vortex made when it deployed over the file */
  fromBackup?: true;
  /** unknown only: in a folder Vortex created, so likely written by a deployed mod at runtime */
  inVortexFolder?: true;
}

/** Unknown files totalled by their first two folders */
export interface IGameFolderFolderCount {
  folder: string;
  files: number;
  bytes: number;
}

/** A finished check, as main hands it to the renderer to send. Times are ms since the epoch. */
export type GameFolderCheckResult = GameFolderCheckOutcome & {
  /** without the local paths, which stay on the machine */
  input: Omit<IGameFolderCheckInput, "steamPath" | "gamePath">;
  folderCreatedAt: number | null;
  manifestCreatedAt: Record<string, number | null>;
  cost: IGameFolderCheckCost;
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
export interface IGameFolderFileReport {
  relPath: string;
  kind: GameFolderFileKind;
  size: number;
  detectedBy?: GameFolderDetection;
  fromBackup?: boolean;
  inVortexFolder?: boolean;
  changedSinceDeploy?: boolean;
}
