import type { GameFacts, StagedFile } from "./gameFacts";
import { FileSourceKind, type FileSource, type Lockfile } from "./lockfile";
import type { IMod, IState } from "./state";

/** The mod source ids Vortex registers, as IMod.attributes.source holds them. */
const VortexModSource = {
  Nexus: "nexus",
  UserGenerated: "user-generated",
  Website: "website",
  Unsupported: "unsupported",
} as const;

/** The lockfile kind of each Vortex mod source; an unregistered source is user generated. */
const fileSourceKindByModSource: Record<string, FileSourceKind> = {
  [VortexModSource.Nexus]: FileSourceKind.Nexus,
  [VortexModSource.UserGenerated]: FileSourceKind.UserGenerated,
  [VortexModSource.Website]: FileSourceKind.UserGenerated,
  [VortexModSource.Unsupported]: FileSourceKind.UserGenerated,
};

function toFileSource(mod: IMod, stagedFile: StagedFile): FileSource {
  const { destinationPath, fileHash } = stagedFile;
  const kind = fileSourceKindByModSource[mod.attributes?.source ?? ""];
  const fileId = mod.attributes?.fileId;
  if (kind === FileSourceKind.Nexus && fileId !== undefined) {
    return { source: FileSourceKind.Nexus, fileId: String(fileId), destinationPath };
  }
  return { source: FileSourceKind.UserGenerated, fileHash, destinationPath };
}

/** The lockfile for a game's enabled mods, sorted by destination. */
export function resolve(state: IState, gameFacts: GameFacts): Lockfile {
  const { gameMode, gameId, gameVersion, storeId } = gameFacts;
  const modsById = state.persistent.mods[gameMode] ?? {};
  const profileId = state.settings.profiles.lastActiveProfile[gameMode];
  const modStateById =
    profileId !== undefined ? (state.persistent.profiles[profileId]?.modState ?? {}) : {};

  // later mods replace earlier ones at the same destination
  const fileByDestination = new Map<string, FileSource>();
  for (const modId of gameFacts.sortedModIds) {
    const mod = modsById[modId];
    if (mod === undefined || modStateById[modId]?.enabled !== true) {
      continue;
    }
    // Vortex state holds overrides as native paths
    const overriddenPaths = new Set(
      (mod.fileOverrides ?? []).map((override) => override.replaceAll("\\", "/")),
    );
    for (const stagedFile of gameFacts.stagedFiles[modId] ?? []) {
      if (!overriddenPaths.has(stagedFile.destinationPath)) {
        fileByDestination.set(stagedFile.destinationPath, toFileSource(mod, stagedFile));
      }
    }
  }

  // destinations are unique
  const files = [...fileByDestination.values()].toSorted((lhs, rhs) =>
    lhs.destinationPath < rhs.destinationPath ? -1 : 1,
  );
  return { version: 1, gameId, gameVersion, storeId, files };
}
