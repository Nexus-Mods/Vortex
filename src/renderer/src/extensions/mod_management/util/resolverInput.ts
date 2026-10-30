import * as path from "node:path";

import {
  FileSourceKind,
  GameStore,
  GogBuildId,
  GogProductId,
  HashType,
  NexusFileId,
  NexusGameId,
  pathKeyOf,
  SteamAppId,
  SteamBuildId,
  SteamDepotId,
  SteamManifestId,
  type GameInstall,
  type ResolverInput,
  type ResolverMod,
  type FileEntry,
} from "@nexusmods/mod-pipeline";
import { parseError, type VortexGameId } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IGame } from "../../../types/IGame";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import getNormalizeFunc from "../../../util/getNormalizeFunc";
import { numericNexusGameId } from "../../analytics/mixpanel/numericGameId";
import { scanInstall } from "../../analytics/utils/storeGameVersionEvent";
import type { IDiscoveryResult } from "../../gamemode_management/types/IDiscoveryResult";
import { getGame } from "../../gamemode_management/util/getGame";
import { getModType } from "../../gamemode_management/util/modTypeExtensions";
import { createVortexNexusV3Client } from "../../nexus_integration/nexusV3Client";
import { resolveFileUID } from "../../nexus_integration/util/UIDs";
import {
  fetchArchiveFiles,
  type ArchiveFiles,
} from "../../nexus_integration/util_v3/archiveManifests";
import { lastActiveProfileForGame, profileById } from "../../profile_management/selectors";
import { mapWithConcurrency } from "../LinkingDeployment";
import { installPathForGame } from "../selectors";
import type { IDeployedFile } from "../types/IDeploymentMethod";
import type { IMod } from "../types/IMod";
import { readOwnManifest } from "./activationStore";
import BlacklistSet from "./BlacklistSet";
import { genSubDirFunc } from "./deploy";
import { deployedFilePath } from "./deployedFilePath";
import { doSortMods } from "./sort";

// files hashed at once; keeps the main process's hash workers, at most 16, busy
const HASH_CONCURRENCY = 16;

/** A path with "/" separators, as lockfile destinations have. */
export const toPortablePath = (filePath: string) => filePath.replaceAll("\\", "/");

/** A mod's origin; a Nexus mod whose file version is unknown is user generated. */
function modOrigin(mod: IMod, gameMode: string): ResolverMod["origin"] {
  const nexusFileId =
    mod.attributes?.source === "nexus" ? resolveFileUID(mod.attributes, gameMode) : undefined;
  return nexusFileId !== undefined
    ? { source: FileSourceKind.Nexus, nexusFileId: NexusFileId(nexusFileId) }
    : { source: FileSourceKind.UserGenerated };
}

/** A mod's staged files with their sizes, relative to its staging folder and "/" separated. */
async function stagedFiles(modPath: string): Promise<{ relPath: string; size: number }[]> {
  const root = QualifiedPath.fromNative(modPath);
  const rootDepth = root.components().toArray().length;
  const files: { relPath: string; size: number }[] = [];
  try {
    const entries = await window.api.fs.enumerateDirectory(root, {
      types: "files",
      recursive: true,
      includeStatus: true,
    });
    for await (const [entry, status] of entries) {
      if (status.isFile) {
        files.push({
          relPath: entry.components().drop(rootDepth).toArray().join("/"),
          size: status.size,
        });
      }
    }
  } catch (err) {
    if (parseError(err).data.kind !== "fs:not-found") {
      throw err;
    }
  }
  return files;
}

/** The game's install, identified by its store's ids. */
async function gameInstall(gameMode: string, discovery: IDiscoveryResult): Promise<GameInstall> {
  const { store } = discovery;
  if (store === GameStore.Epic || store === GameStore.Xbox) {
    return { store };
  }
  if (store !== GameStore.Steam && store !== GameStore.Gog) {
    throw new Error(`${gameMode} is installed from ${store}, which has no lockfile ids`);
  }
  const { install, failureReason } = await scanInstall(gameMode, discovery);
  if (install === null) {
    throw new Error(`${gameMode}'s ${store} install is unreadable: ${failureReason}`);
  }
  return "app_id" in install
    ? {
        store: GameStore.Steam,
        appId: SteamAppId(install.app_id),
        buildId: SteamBuildId(install.build_id),
        depots: install.depots.map((depot) => ({
          depotId: SteamDepotId(depot.depot_id),
          manifestId: SteamManifestId(depot.manifest_id),
        })),
      }
    : {
        store: GameStore.Gog,
        productId: GogProductId(install.product_id),
        buildId: GogBuildId(install.build_id),
      };
}

/** The skip list a mod type's deployment applies, keyed by mod type id. */
async function skipListsByType(
  game: IGame,
  modPaths: Record<string, string>,
): Promise<Map<string, { skipFiles: BlacklistSet; normalize: (input: string) => string }>> {
  const skipLists = new Map<
    string,
    { skipFiles: BlacklistSet; normalize: (input: string) => string }
  >();
  for (const [typeId, deployPath] of Object.entries(modPaths)) {
    if (deployPath) {
      const normalize = await getNormalizeFunc(deployPath);
      skipLists.set(typeId, { skipFiles: new BlacklistSet([], game, normalize), normalize });
    }
  }
  return skipLists;
}

interface IStagedSource {
  stagedPath: string;
  destinationPath: string;
  /** its mod's staged files */
  into: FileEntry[];
  /** the Nexus file version its mod was installed from */
  nexusFileId?: NexusFileId;
  /** "/" separated, relative to its mod's staging folder */
  portableRelPath: string;
  size: number;
}

/**
 * The MD5 a staged file has in its archive: the entries at its path, or under a folder the installer
 * stripped, that match its size must agree on one.
 */
function archiveMd5(
  source: IStagedSource,
  archiveFiles: ArchiveFiles | undefined,
): string | undefined {
  const { portableRelPath, size } = source;
  const md5s = new Set(
    (archiveFiles?.get(path.posix.basename(portableRelPath)) ?? [])
      .filter(
        (archiveFile) =>
          (archiveFile.path === portableRelPath ||
            archiveFile.path.endsWith(`/${portableRelPath}`)) &&
          archiveFile.size === size,
      )
      .map(({ md5 }) => md5),
  );
  return md5s.size === 1 ? [...md5s][0] : undefined;
}

type ArchiveFilesLookup = (versionIds: string[]) => Promise<ReadonlyMap<string, ArchiveFiles>>;

/** The game a lockfile can be resolved for: discovered, with a Nexus game id and a store. */
function resolvableGame(state: IState, gameMode: VortexGameId) {
  const game = getGame(gameMode);
  const discovery = state.settings.gameMode.discovered[gameMode];
  if (game === undefined || discovery?.path === undefined) {
    throw new Error(`${gameMode} is not a discovered game`);
  }
  const gameId = numericNexusGameId(gameMode);
  if (gameId === null) {
    throw new Error(`${gameMode} has no Nexus game id`);
  }
  if (discovery.store === undefined) {
    throw new Error(`${gameMode} has no store recorded`);
  }
  return { game, discovery, gamePath: discovery.path, gameId: NexusGameId(gameId) };
}

/** The Nexus file versions to look archive manifests up for. */
const nexusFileIds = (origins: Iterable<ResolverMod["origin"]>): NexusFileId[] => [
  ...new Set(
    [...origins].flatMap((origin) =>
      origin.source === FileSourceKind.Nexus ? [origin.nexusFileId] : [],
    ),
  ),
];

/** Hashes each source into its mod's staged files, from its archive's manifest where it can. */
async function addHashedFiles(
  sources: IStagedSource[],
  pendingArchiveFiles: Promise<ReadonlyMap<string, ArchiveFiles>>,
  hashFile: (filePath: string) => Promise<string>,
): Promise<void> {
  const archiveFilesByVersion = await pendingArchiveFiles;
  const fileHashes = await mapWithConcurrency(
    sources,
    (source) => {
      const archiveFiles =
        source.nexusFileId !== undefined
          ? archiveFilesByVersion.get(source.nexusFileId)
          : undefined;
      return archiveMd5(source, archiveFiles) ?? hashFile(source.stagedPath);
    },
    HASH_CONCURRENCY,
  );
  sources.forEach((source, index) => {
    source.into.push({
      destinationPath: source.destinationPath,
      fileHash: fileHashes[index],
      hashType: HashType.Md5,
    });
  });
}

const fetchArchiveFilesFor =
  (api: IExtensionApi): ArchiveFilesLookup =>
  (versionIds) =>
    fetchArchiveFiles(createVortexNexusV3Client(api), versionIds);

/**
 * The resolver input for a game's deploying mods. A staged Nexus file takes its hash from its
 * archive's manifest where that is unambiguous.
 */
export async function gatherResolverInput(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
  lookupArchiveFiles: ArchiveFilesLookup = fetchArchiveFilesFor(api),
): Promise<ResolverInput> {
  const state: IState = api.getState();
  const { game, discovery, gamePath, gameId } = resolvableGame(state, gameMode);
  const profile = profileById(state, lastActiveProfileForGame(state, gameMode));
  if (profile === undefined) {
    throw new Error(`${gameMode} has no profile`);
  }

  const sortedMods = await doSortMods(api, profile, state.persistent.mods[gameMode] ?? {});
  const modPaths = game.getModPaths(gamePath);
  const skipLists = await skipListsByType(game, modPaths);
  const stagingPath = installPathForGame(state, gameMode);

  const modOrigins = sortedMods.map((mod) => ({ mod, origin: modOrigin(mod, gameMode) }));
  // the manifests download while the staging folders are walked
  const pendingArchiveFiles = lookupArchiveFiles(
    nexusFileIds(modOrigins.map(({ origin }) => origin)),
  );

  const mods: ResolverMod[] = [];
  const sources: IStagedSource[] = [];
  for (const { mod, origin } of modOrigins) {
    const typeId = mod.type ?? "";
    const skipList = skipLists.get(typeId);
    if (skipList === undefined) {
      continue;
    }
    const resolverMod: ResolverMod = {
      origin,
      stagedFiles: [],
      overriddenPaths: (mod.fileOverrides ?? []).map(toPortablePath),
    };
    mods.push(resolverMod);
    const nexusFileId = origin.source === FileSourceKind.Nexus ? origin.nexusFileId : undefined;
    const subDir = genSubDirFunc(game, getModType(mod.type))(mod);
    const modPath = path.join(stagingPath, mod.installationPath);
    for (const { relPath, size } of await stagedFiles(modPath)) {
      if (!skipList.skipFiles.has(skipList.normalize(path.join(mod.installationPath, relPath)))) {
        sources.push({
          stagedPath: path.join(modPath, relPath),
          destinationPath: toPortablePath(deployedFilePath(modPaths[typeId], subDir, relPath)),
          into: resolverMod.stagedFiles,
          nexusFileId,
          portableRelPath: relPath,
          size,
        });
      }
    }
  }

  await addHashedFiles(sources, pendingArchiveFiles, hashFile);

  return { gameId, install: await gameInstall(gameMode, discovery), mods };
}

/** A manifest entry traced to its installed mod and staged file, in deploy order. */
interface DeployedEntry {
  mod: IMod;
  stagedPath: string;
  /** "/" separated, relative to its mod's staging folder */
  portableRelPath: string;
  size: number;
  destinationPath: string;
}

const overridesDestination = ({ mod }: DeployedEntry, destinationKey: string) =>
  (mod.fileOverrides ?? []).some(
    (override) => pathKeyOf(toPortablePath(override)) === destinationKey,
  );

/**
 * The seed's whole precedence step, as today's deployment decides between mod types: an entry whose
 * mod does not override the destination beats one whose mod does, then the type deployed later
 * wins. Each clash is noted.
 */
function keepOnePerDestination(deployed: DeployedEntry[], notes: string[]): DeployedEntry[] {
  const kept = new Set<DeployedEntry>();
  const byDestination = Map.groupBy(deployed, ({ destinationPath }) => pathKeyOf(destinationPath));
  for (const [destinationKey, entries] of byDestination) {
    const keeper =
      entries.length > 1
        ? (entries.filter((entry) => !overridesDestination(entry, destinationKey)).at(-1) ??
          entries.at(-1))
        : entries.at(0);
    if (keeper === undefined) {
      continue;
    }
    kept.add(keeper);
    if (entries.length > 1) {
      notes.push(
        `${keeper.destinationPath} is listed by ${entries.length} mod types' manifests; "${keeper.mod.installationPath}" keeps it`,
      );
    }
  }
  return deployed.filter((entry) => kept.has(entry));
}

/**
 * The resolver input for what a game's deployment manifests say this instance deployed, one file
 * per destination. An entry that can't be traced to a staged file is left out with a note.
 */
export async function gatherDeployedInput(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
  lookupArchiveFiles: ArchiveFilesLookup = fetchArchiveFilesFor(api),
): Promise<{ input: ResolverInput; notes: string[] }> {
  const state: IState = api.getState();
  const { game, discovery, gamePath, gameId } = resolvableGame(state, gameMode);
  const modPaths = game.getModPaths(gamePath);
  const stagingPath = installPathForGame(state, gameMode);
  const modByFolder = new Map(
    Object.values(state.persistent.mods[gameMode] ?? {}).map((mod) => [mod.installationPath, mod]),
  );
  const notes: string[] = [];

  // mod types in deploy order, so the later of two listing one path comes last
  const listed: { mod: IMod; file: IDeployedFile; deployPath: string }[] = [];
  for (const [typeId, deployPath] of Object.entries(modPaths)) {
    if (!deployPath) {
      continue;
    }
    const read = await readOwnManifest(api, typeId, deployPath, stagingPath);
    if (read.kind === "missing") {
      continue;
    }
    if (read.kind !== "read") {
      const reason =
        read.kind === "damaged" ? "is damaged" : "was written by another Vortex instance";
      notes.push(`the "${typeId}" mod type's manifest ${reason}`);
      continue;
    }
    for (const file of read.manifest.files) {
      const mod = modByFolder.get(file.source);
      if (mod === undefined) {
        notes.push(`${file.relPath} came from "${file.source}", which is not an installed mod`);
        continue;
      }
      listed.push({ mod, file, deployPath: read.manifest.targetPath ?? deployPath });
    }
  }
  const originByMod = new Map(listed.map(({ mod }) => [mod, modOrigin(mod, gameMode)] as const));
  // the manifests download while the staging folders are walked
  const pendingArchiveFiles = lookupArchiveFiles(nexusFileIds(originByMod.values()));

  const sizesByFolder = new Map<string, ReadonlyMap<string, number>>();
  const deployed: DeployedEntry[] = [];
  for (const { mod, file, deployPath } of listed) {
    const modPath = path.join(stagingPath, mod.installationPath);
    let sizes = sizesByFolder.get(mod.installationPath);
    if (sizes === undefined) {
      sizes = new Map(
        (await stagedFiles(modPath)).map(({ relPath, size }) => [relPath, size] as const),
      );
      sizesByFolder.set(mod.installationPath, sizes);
    }
    const portableRelPath = toPortablePath(file.relPath);
    const size = sizes.get(portableRelPath);
    if (size === undefined) {
      notes.push(`${file.relPath} is not staged in "${mod.installationPath}"`);
      continue;
    }
    deployed.push({
      mod,
      stagedPath: path.join(modPath, file.relPath),
      portableRelPath,
      size,
      destinationPath: toPortablePath(deployedFilePath(deployPath, file.target, file.relPath)),
    });
  }

  // destinations are unique once kept, so files group by mod alone
  const resolverMods = new Map<IMod, ResolverMod>();
  const sources: IStagedSource[] = [];
  for (const entry of keepOnePerDestination(deployed, notes)) {
    let resolverMod = resolverMods.get(entry.mod);
    if (resolverMod === undefined) {
      const origin = originByMod.get(entry.mod) ?? modOrigin(entry.mod, gameMode);
      resolverMod = { origin, stagedFiles: [], overriddenPaths: [] };
      resolverMods.set(entry.mod, resolverMod);
    }
    sources.push({
      stagedPath: entry.stagedPath,
      destinationPath: entry.destinationPath,
      into: resolverMod.stagedFiles,
      nexusFileId:
        resolverMod.origin.source === FileSourceKind.Nexus
          ? resolverMod.origin.nexusFileId
          : undefined,
      portableRelPath: entry.portableRelPath,
      size: entry.size,
    });
  }
  await addHashedFiles(sources, pendingArchiveFiles, hashFile);

  const mods = [...resolverMods.values()];
  return { input: { gameId, install: await gameInstall(gameMode, discovery), mods }, notes };
}
