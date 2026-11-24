import {
  DiskEntryKind,
  FileSourceKind,
  GameStore,
  HashType,
  NexusFileId,
  NexusGameId,
  SteamAppId,
  SteamBuildId,
  SteamDepotId,
  SteamManifestId,
  type DiskEntry,
  type DiskScan,
  type FileSource,
  type GeneratedFileSource,
  type Lockfile,
} from "@nexusmods/mod-pipeline";

/** A generated plugins.txt as the lockfile records it. */
export function makeGeneratedFileSource(
  overrides: Partial<GeneratedFileSource> = {},
): GeneratedFileSource {
  return {
    source: FileSourceKind.VortexGenerated,
    destinationPath: "/fixture-root/appdata/Skyrim Special Edition/plugins.txt",
    fileHash: "plugins-txt-hash",
    hashType: HashType.Md5,
    ...overrides,
  };
}

/** An unhashed file on disk where SkyUI's plugin deploys. */
export function makeDiskEntry(overrides: Partial<DiskEntry> = {}): DiskEntry {
  return {
    path: "/fixture-root/game/Data/SkyUI_SE.esp",
    kind: DiskEntryKind.File,
    size: 1024,
    modifiedTime: Temporal.Instant.from("2025-10-09T08:53:20Z"),
    ...overrides,
  };
}

/** A scan of Skyrim SE's game folder that found nothing. */
export function makeDiskScan(overrides: Partial<DiskScan> = {}): DiskScan {
  return {
    takenAt: Temporal.Instant.from("2026-10-21T09:00:00Z"),
    roots: ["/fixture-root/game"],
    entries: [],
    ...overrides,
  };
}

type NexusFileSource = Extract<FileSource, { source: typeof FileSourceKind.Nexus }>;

/** SkyUI's plugin as the lockfile records it. */
export function makeNexusFileSource(overrides: Partial<NexusFileSource> = {}): NexusFileSource {
  return {
    source: FileSourceKind.Nexus,
    nexusFileId: NexusFileId("7318624307791"),
    fileHash: "skyui-esp-hash",
    hashType: HashType.Md5,
    destinationPath: "/fixture-root/game/Data/SkyUI_SE.esp",
    ...overrides,
  };
}

/** Skyrim SE's lockfile with SkyUI's two files, in destination order. */
export function makeLockfile(overrides: Partial<Lockfile> = {}): Lockfile {
  return {
    version: 1,
    gameId: NexusGameId(1704),
    install: {
      store: GameStore.Steam,
      appId: SteamAppId(489830),
      buildId: SteamBuildId(15218373),
      depots: [
        { depotId: SteamDepotId(489833), manifestId: SteamManifestId("1914580699073641964") },
      ],
    },
    files: [
      makeNexusFileSource(),
      makeNexusFileSource({
        fileHash: "skyui-config-hash",
        destinationPath: "/fixture-root/game/Data/interface/skyui/config.txt",
      }),
    ],
    ...overrides,
  };
}
