import {
  deployingFiles,
  FileSourceKind,
  GameStore,
  GogBuildId,
  GogProductId,
  HashType,
  NexusFileId,
  NexusGameId,
  pathKeyOf,
  sameFile,
  SteamAppId,
  SteamBuildId,
  SteamDepotId,
  SteamManifestId,
  type FileOrigin,
  type FileSource,
  type GameInstall,
  type ResolverInput,
  type ResolverMod,
  type FileEntry,
} from "@nexusmods/mod-pipeline";
import { QualifiedPath, relativePath, type RelativePath } from "@nexusmods/paths";
import { parseError, VortexGameId, VortexModTypeId, type VortexProfileId } from "@vortex/shared";
import { NativePathResolver, type FileStatus } from "@vortex/shared/filesystem";

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
import { profileById } from "../../profile_management/selectors";
import { mapWithConcurrency } from "../LinkingDeployment";
import { installPathForGame } from "../selectors";
import type { IDeployedFile } from "../types/IDeploymentMethod";
import type { IMod } from "../types/IMod";
import { readOwnManifest } from "./activationStore";
import type { StagedFiles } from "./apply/apply";
import BlacklistSet from "./BlacklistSet";
import { genSubDirFunc } from "./deploy";
import { deployedFilePath } from "./deployedFilePath";
import { doSortMods } from "./sort";

// files hashed at once; keeps the main process's hash workers, at most 16, busy
const HASH_CONCURRENCY = 16;

const nativePaths = new NativePathResolver();

/** An absolute path in the sanitized, "/" separated form lockfile destinations and scan roots share. */
export const toPortablePath = (filePath: string) => QualifiedPath.fromNative(filePath).path;

/** A mod's origin; a Nexus mod whose file version is unknown is user generated. */
export function modOrigin(mod: IMod, gameMode: string): ResolverMod["origin"] {
  const nexusFileId =
    mod.attributes?.source === "nexus" ? resolveFileUID(mod.attributes, gameMode) : undefined;
  return nexusFileId !== undefined
    ? { source: FileSourceKind.Nexus, nexusFileId: NexusFileId(nexusFileId) }
    : { source: FileSourceKind.UserGenerated };
}

/** The mod type a mod deploys as, and the folder below that type's folder its files go into. */
export const deployFolderOf = (game: IGame, mod: IMod) => ({
  typeId: VortexModTypeId(mod.type ?? ""),
  subDir: genSubDirFunc(game, getModType(mod.type))(mod),
});

/** A game's installed mods, by the name of their staging folder. */
export const installedModsByFolder = (state: IState, gameMode: VortexGameId) =>
  new Map(
    Object.values(state.persistent.mods[gameMode] ?? {}).map((mod) => [mod.installationPath, mod]),
  );

/** A mod's staged files, each with its status. */
async function stagedFiles(modPath: QualifiedPath): Promise<[QualifiedPath, FileStatus][]> {
  const files: [QualifiedPath, FileStatus][] = [];
  try {
    const entries = await window.api.fs.enumerateDirectory(modPath, {
      types: "files",
      recursive: true,
      includeStatus: true,
    });
    for await (const [entry, status] of entries) {
      if (status.isFile) {
        files.push([entry, status]);
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
): Promise<
  Map<VortexModTypeId, { skipFiles: BlacklistSet; normalize: (input: string) => string }>
> {
  const skipLists = new Map<
    VortexModTypeId,
    { skipFiles: BlacklistSet; normalize: (input: string) => string }
  >();
  for (const [typeId, deployPath] of Object.entries(modPaths)) {
    if (deployPath) {
      const normalize = await getNormalizeFunc(deployPath);
      skipLists.set(VortexModTypeId(typeId), {
        skipFiles: new BlacklistSet([], game, normalize),
        normalize,
      });
    }
  }
  return skipLists;
}

interface IStagedSource {
  /** resolved to its native form */
  stagedPath: string;
  destinationPath: string;
  /** its mod's staged files */
  into: FileEntry[];
  /** the Nexus file version its mod was installed from */
  nexusFileId?: NexusFileId;
  /** relative to its mod's staging folder */
  relPath: RelativePath;
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
  const { relPath, size } = source;
  const md5s = new Set(
    (archiveFiles?.get(relPath.slice(relPath.lastIndexOf("/") + 1)) ?? [])
      .filter(
        (archiveFile) =>
          (archiveFile.path === relPath || archiveFile.path.endsWith(`/${relPath}`)) &&
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

/**
 * Hashes each source into its mod's staged files, from its archive's manifest where it can, and
 * gives each source's file.
 */
async function addHashedFiles(
  sources: IStagedSource[],
  pendingArchiveFiles: Promise<ReadonlyMap<string, ArchiveFiles>>,
  hashFile: (filePath: string) => Promise<string>,
): Promise<FileEntry[]> {
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
  return sources.map((source, index) => {
    const file: FileEntry = {
      destinationPath: source.destinationPath,
      fileHash: fileHashes[index],
      hashType: HashType.Md5,
    };
    source.into.push(file);
    return file;
  });
}

/** Staged files from the staged path at each destination key, "/" separated as Apply takes it. */
const stagedFilesAt = (stagedPathByKey: ReadonlyMap<string, string>): StagedFiles => ({
  pathOf: (file) => stagedPathByKey.get(pathKeyOf(file.destinationPath)),
});

const fetchArchiveFilesFor =
  (api: IExtensionApi): ArchiveFilesLookup =>
  (versionIds) =>
    fetchArchiveFiles(createVortexNexusV3Client(api), versionIds);

/** Manifest entries, by the mod type whose manifest lists them. */
export type ManifestFiles = ReadonlyMap<VortexModTypeId, IDeployedFile[]>;

/** A manifest entry and the mod type whose manifest lists it. */
export interface ManifestEntry {
  typeId: VortexModTypeId;
  file: IDeployedFile;
}

export const manifestFilesOf = (entries: Iterable<ManifestEntry>): ManifestFiles =>
  new Map(
    [...Map.groupBy(entries, ({ typeId }) => typeId)].map(([typeId, listed]) => [
      typeId,
      listed.map(({ file }) => file),
    ]),
  );

/** A staged file a deploying mod has for a destination, whether or not the lockfile takes it. */
interface IDeployableSource extends IStagedSource {
  origin: ResolverMod["origin"];
  /** "/" separated, as Apply takes it */
  portableStagedPath: string;
}

/**
 * Finds the staged file a resolved file comes from: at its destination, the last in mod order that
 * its mod deploys with its origin and content. `files` are the sources' files, in their order.
 */
function stagedFileLookup(
  mods: readonly ResolverMod[],
  sources: readonly IDeployableSource[],
  files: readonly FileEntry[],
) {
  const deploying = new Set(mods.flatMap(deployingFiles));
  const stagedByDestination = Map.groupBy(
    sources
      .map((source, index) => ({ source, file: files[index] }))
      .filter(({ file }) => deploying.has(file)),
    ({ file }) => pathKeyOf(file.destinationPath),
  );
  return (resolved: FileSource) =>
    stagedByDestination
      .get(pathKeyOf(resolved.destinationPath))
      ?.findLast(({ source, file }) => sameFile({ ...source.origin, ...file }, resolved))?.source;
}

/**
 * The resolver input for a profile's deploying mods, and where files resolved from it are staged.
 * A staged Nexus file takes its hash from its archive's manifest where that is unambiguous.
 */
export async function gatherResolverInput(
  api: IExtensionApi,
  profileId: VortexProfileId,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
  lookupArchiveFiles: ArchiveFilesLookup = fetchArchiveFilesFor(api),
): Promise<{
  input: ResolverInput;
  /** where `files` are staged */
  stagedFilesFor: (files: readonly FileSource[]) => StagedFiles;
}> {
  const state: IState = api.getState();
  const profile = profileById(state, profileId);
  if (profile === undefined) {
    throw new Error(`there is no profile ${profileId}`);
  }
  const gameMode = VortexGameId(profile.gameId);
  const { game, discovery, gamePath, gameId } = resolvableGame(state, gameMode);

  const sortedMods = await doSortMods(api, profile, state.persistent.mods[gameMode] ?? {});
  const modPaths = game.getModPaths(gamePath);
  const skipLists = await skipListsByType(game, modPaths);
  const stagingPath = QualifiedPath.fromNative(installPathForGame(state, gameMode));

  const modOrigins = sortedMods.map((mod) => ({ mod, origin: modOrigin(mod, gameMode) }));
  // the manifests download while the staging folders are walked
  const pendingArchiveFiles = lookupArchiveFiles(
    nexusFileIds(modOrigins.map(({ origin }) => origin)),
  );

  const mods: ResolverMod[] = [];
  const sources: IDeployableSource[] = [];
  for (const { mod, origin } of modOrigins) {
    const { typeId, subDir } = deployFolderOf(game, mod);
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
    const modPath = stagingPath.join(mod.installationPath);
    for (const [stagedFile, status] of await stagedFiles(modPath)) {
      const relPath = stagedFile.relativeTo(modPath);
      if (!skipList.skipFiles.has(skipList.normalize(`${mod.installationPath}/${relPath}`))) {
        const destinationPath = toPortablePath(deployedFilePath(modPaths[typeId], subDir, relPath));
        const stagedPath = await nativePaths.resolve(stagedFile);
        sources.push({
          stagedPath,
          destinationPath,
          into: resolverMod.stagedFiles,
          nexusFileId,
          relPath,
          size: status.size,
          origin,
          portableStagedPath: stagedFile.path,
        });
      }
    }
  }

  const stagedFileOf = stagedFileLookup(
    mods,
    sources,
    await addHashedFiles(sources, pendingArchiveFiles, hashFile),
  );
  return {
    input: { gameId, install: await gameInstall(gameMode, discovery), mods },
    // one path per destination, so the lookup and its sources end with the plan
    stagedFilesFor: (files) =>
      stagedFilesAt(
        new Map(
          files.flatMap((file) => {
            const staged = stagedFileOf(file);
            return staged !== undefined
              ? [[pathKeyOf(file.destinationPath), staged.portableStagedPath] as const]
              : [];
          }),
        ),
      ),
  };
}

/** A manifest entry traced to its installed mod and staged file, in deploy order. */
interface DeployedEntry {
  mod: IMod;
  stagedFile: QualifiedPath;
  /** relative to its mod's staging folder */
  relPath: RelativePath;
  size: number;
  destinationPath: string;
}

const overridesDestination = ({ mod }: { mod: IMod }, destinationKey: string) =>
  (mod.fileOverrides ?? []).some(
    (override) => pathKeyOf(toPortablePath(override)) === destinationKey,
  );

/**
 * The seed's whole precedence step, as today's deployment decides between mod types: an entry whose
 * mod does not override the destination beats one whose mod does, then the type deployed later
 * wins. Each clash is noted.
 */
function keepOnePerDestination<Entry extends { mod: IMod; destinationPath: string }>(
  deployed: Entry[],
  notes: string[],
): Entry[] {
  const kept = new Set<Entry>();
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

/** A manifest entry traced to its installed mod, with the folder its mod type deploys to. */
interface ListedEntry {
  mod: IMod;
  typeId: VortexModTypeId;
  file: IDeployedFile;
  deployPath: string;
}

/** A game's manifest entries of installed mods, in deploy order; the rest are noted. */
async function listManifestEntries(
  api: IExtensionApi,
  gameMode: VortexGameId,
  notes: string[],
): Promise<ListedEntry[]> {
  const state: IState = api.getState();
  const { game, gamePath } = resolvableGame(state, gameMode);
  const modPaths = game.getModPaths(gamePath);
  const stagingPath = installPathForGame(state, gameMode);
  const modByFolder = installedModsByFolder(state, gameMode);

  // mod types in deploy order, so the later of two listing one path comes last
  const listed: ListedEntry[] = [];
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
      listed.push({
        mod,
        typeId: VortexModTypeId(typeId),
        file,
        deployPath: read.manifest.targetPath ?? deployPath,
      });
    }
  }
  return listed;
}

/** A destination a deployment wrote, and where its file comes from. */
export type DeployedOrigin = FileOrigin & { destinationPath: string };

/** A game's manifests for installed mods: one origin per destination, and entries by mod type. */
export async function gatherDeployed(
  api: IExtensionApi,
  gameMode: VortexGameId,
): Promise<{ origins: DeployedOrigin[]; manifestFiles: ManifestFiles }> {
  const notes: string[] = [];
  const listed = await listManifestEntries(api, gameMode, notes);
  const entries = listed.map(({ mod, file, deployPath }) => ({
    mod,
    destinationPath: toPortablePath(deployedFilePath(deployPath, file.target, file.relPath)),
  }));
  return {
    origins: keepOnePerDestination(entries, notes).map(({ mod, destinationPath }) => ({
      ...modOrigin(mod, gameMode),
      destinationPath,
    })),
    manifestFiles: manifestFilesOf(listed),
  };
}

/**
 * The resolver input for what a game's deployment manifests say this instance deployed, one file
 * per destination, and the staged file each destination came from. An entry that can't be traced to
 * a staged file is left out with a note.
 */
export async function gatherDeployedInput(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
  lookupArchiveFiles: ArchiveFilesLookup = fetchArchiveFilesFor(api),
): Promise<{ input: ResolverInput; notes: string[]; stagedFiles: StagedFiles }> {
  const state: IState = api.getState();
  const { discovery, gameId } = resolvableGame(state, gameMode);
  const stagingPath = QualifiedPath.fromNative(installPathForGame(state, gameMode));
  const notes: string[] = [];
  const listed = await listManifestEntries(api, gameMode, notes);
  const originByMod = new Map(listed.map(({ mod }) => [mod, modOrigin(mod, gameMode)] as const));
  // the manifests download while the staging folders are walked
  const pendingArchiveFiles = lookupArchiveFiles(nexusFileIds(originByMod.values()));

  const sizesByFolder = new Map<string, ReadonlyMap<RelativePath, number>>();
  const deployed: DeployedEntry[] = [];
  for (const { mod, file, deployPath } of listed) {
    const modPath = stagingPath.join(mod.installationPath);
    let sizes = sizesByFolder.get(mod.installationPath);
    if (sizes === undefined) {
      sizes = new Map(
        (await stagedFiles(modPath)).map(
          ([stagedPath, { size }]) => [stagedPath.relativeTo(modPath), size] as const,
        ),
      );
      sizesByFolder.set(mod.installationPath, sizes);
    }
    const relPath = relativePath(file.relPath);
    const size = sizes.get(relPath);
    if (size === undefined) {
      notes.push(`${file.relPath} is not staged in "${mod.installationPath}"`);
      continue;
    }
    deployed.push({
      mod,
      stagedFile: modPath.join(relPath),
      relPath,
      size,
      destinationPath: toPortablePath(deployedFilePath(deployPath, file.target, file.relPath)),
    });
  }

  // destinations are unique once kept, so files group by mod alone
  const resolverMods = new Map<IMod, ResolverMod>();
  const sources: IStagedSource[] = [];
  const stagedPathByKey = new Map<string, string>();
  for (const entry of keepOnePerDestination(deployed, notes)) {
    stagedPathByKey.set(pathKeyOf(entry.destinationPath), entry.stagedFile.path);
    let resolverMod = resolverMods.get(entry.mod);
    if (resolverMod === undefined) {
      const origin = originByMod.get(entry.mod) ?? modOrigin(entry.mod, gameMode);
      resolverMod = { origin, stagedFiles: [], overriddenPaths: [] };
      resolverMods.set(entry.mod, resolverMod);
    }
    sources.push({
      stagedPath: await nativePaths.resolve(entry.stagedFile),
      destinationPath: entry.destinationPath,
      into: resolverMod.stagedFiles,
      nexusFileId:
        resolverMod.origin.source === FileSourceKind.Nexus
          ? resolverMod.origin.nexusFileId
          : undefined,
      relPath: entry.relPath,
      size: entry.size,
    });
  }
  await addHashedFiles(sources, pendingArchiveFiles, hashFile);

  const mods = [...resolverMods.values()];
  return {
    input: { gameId, install: await gameInstall(gameMode, discovery), mods },
    notes,
    stagedFiles: stagedFilesAt(stagedPathByKey),
  };
}
