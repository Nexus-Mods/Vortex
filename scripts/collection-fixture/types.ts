/**
 * Shapes the fixture generator emits. They are deliberately local, minimal mirrors of the
 * renderer's `IMod`, `IDownload`, `IProfile` and collection manifest types
 * (`src/renderer/src/extensions/mod_management/types/IMod.ts`,
 * `src/renderer/src/extensions/download_management/types/IDownload.ts`,
 * `src/renderer/src/extensions/collections/types/ICollection.ts`). The renderer types pull in the
 * renderer runtime and its module aliases, which a standalone `tsx` script cannot resolve, so the
 * generator carries its own copies of just the fields it writes.
 */

export type GameId = "stardewvalley" | "skyrimse" | "fallout4";

export interface IFixtureSpec {
  game: GameId;
  /** collection members (mods installed as part of the collection) */
  members: number;
  /** install phases the members are spread over (1 or more) */
  phases: number;
  /** share of members that are `recommends` (optional) rules, 0..1 */
  optionalRatio: number;
  /** installed mods outside the collection, to model an existing library */
  library: number;
  /**
   * how many installed mods (members plus library, not counting the collection itself) are
   * enabled in the profile. The rest are disabled, library mods first, then optional members,
   * then required members.
   */
  enabled: number;
  /** the benchmark tier the size came from, if any; recorded in the summary */
  tier?: string;
  /** share of members that share a file path with other members, so deployment has real conflicts */
  overlapRatio: number;
  /** seeds every random choice, so the same spec produces byte-identical output */
  seed: number;
  /** absolute directory the fixture is written to; every path in the state points under it */
  outDir: string;
  collectionName: string;
  /** leave Vortex's auto-deploy on; off by default so the tester deploys by hand and times it */
  autoDeploy: boolean;
}

export interface IModReferenceRecord {
  id?: string;
  idHint?: string;
  archiveId?: string;
  tag?: string;
  logicalFileName?: string;
  versionMatch?: string;
  fileMD5?: string;
  fileSize?: number;
  gameId?: string;
  repo?: { repository: string; gameId: string; modId: string; fileId: string };
}

export interface IModRuleRecord {
  type: "before" | "after" | "requires" | "recommends" | "conflicts";
  reference: IModReferenceRecord;
  phase?: number;
  ignored?: boolean;
  extra?: Record<string, unknown>;
}

export interface IModRecord {
  id: string;
  state: "installed";
  type: string;
  archiveId?: string;
  installationPath: string;
  attributes: Record<string, unknown>;
  rules?: IModRuleRecord[];
}

export interface IDownloadRecord {
  id: string;
  state: "finished";
  urls: string[];
  localPath: string;
  game: string[];
  modInfo: Record<string, unknown>;
  installed?: { gameId: string; modId: string };
  fileMD5: string;
  startTime: number;
  fileTime: number;
  size: number;
  received: number;
  verified: number;
}

export interface IProfileRecord {
  id: string;
  gameId: string;
  name: string;
  modState: Record<string, { enabled: boolean; enabledTime: number }>;
  lastActivated: number;
}

/** One file the fixture writes, relative to the output directory. */
export interface IFixtureFile {
  path: string;
  content: Buffer | string;
}

export interface IFixturePaths {
  outDir: string;
  gameDir: string;
  stagingDir: string;
  downloadsRoot: string;
  downloadsDir: string;
  userDataDir: string;
  stateFile: string;
  localAppDataDir?: string;
  documentsDir?: string;
}

export interface IFixtureSummary {
  game: GameId;
  collectionId: string;
  profileId: string;
  instanceId: string;
  members: number;
  optional: number;
  phases: number;
  library: number;
  enabled: number;
  disabled: number;
  tier?: string;
  overlapping: number;
  memberRules: number;
  files: number;
  bytes: number;
}

/** The state backup Vortex imports with `--merge`: one key per hive, merged over the defaults. */
export interface IFixtureState {
  app: { instanceId: string };
  settings: {
    gameMode: {
      discovered: Record<string, { path: string; pathSetManually: boolean; timestamp: number }>;
    };
    mods: {
      installPath: Record<string, string>;
      activator: Record<string, string>;
    };
    downloads: { path: string };
    profiles: {
      activeProfileId: string;
      nextProfileId: string;
      lastActiveProfile: Record<string, string>;
    };
    automation: { deploy: boolean };
  };
  persistent: {
    profiles: Record<string, IProfileRecord>;
    mods: Record<string, Record<string, IModRecord>>;
    downloads: { files: Record<string, IDownloadRecord> };
    categories: Record<string, Record<string, { name: string; order: number }>>;
  };
}

export interface IFixture {
  spec: IFixtureSpec;
  paths: IFixturePaths;
  state: IFixtureState;
  /** directories that must exist even when empty (the fake game's folder skeleton) */
  directories: string[];
  files: IFixtureFile[];
  summary: IFixtureSummary;
}
