import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IDownloadedFile, IInstalledFile } from "@/extensions/health_check/types";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import { nexusGamesProm } from "@/extensions/nexus_integration/util";
import { makeFileUID, makeModUID } from "@/extensions/nexus_integration/util/UIDs";
import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IProfile } from "@/extensions/profile_management/types/IProfile";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { renderModName } from "@/util/api";
import { getSafe } from "@/util/storeHelper";

/** The subset of mod attributes the file-level gather/hydrate reads. */
interface IInstalledModAttributes {
  source?: string;
  modId?: number | string;
  fileId?: number | string;
  downloadGame?: string;
  version?: string;
  fileName?: string;
  logicalFileName?: string;
  pictureUrl?: string;
  referenceTag?: string;
}

/**
 * An installed Nexus file for the resolver. It uses `fileUID` and `enabled`;
 * `modId` lets the output hydrate display data on demand.
 */
export interface IInstalledFileRef {
  /** Composite file version id (the resolver's fileVersionUid). */
  fileUID: string;
  /** Vortex mod id, for on-demand display hydration in the output. */
  modId: string;
  /** Whether the file is enabled in the active profile. */
  enabled: boolean;
  /** False for files installed by a collection on the active profile (they satisfy but don't emit). */
  emitRequirements: boolean;
}

/**
 * Reference tags of mods pulled in by a collection installed on the active
 * profile; files carrying one satisfy requirements but don't emit their own.
 * Edit `countsForProfile` to change which collections count.
 */
function collectionManagedTags(mods: { [modId: string]: IMod }, profile: IProfile): Set<string> {
  const countsForProfile = (collection: IMod): boolean => profile.modState?.[collection.id] != null;

  const tags = new Set<string>();
  for (const mod of Object.values(mods)) {
    if (mod.type !== "collection" || !countsForProfile(mod)) {
      continue;
    }
    for (const rule of mod.rules ?? []) {
      if (rule.type === "requires" && rule.reference?.tag != null) {
        tags.add(rule.reference.tag);
      }
    }
  }
  return tags;
}

/**
 * Resolve a Nexus file UID for a mod, or return undefined if not possible.
 * Shared by both gather functions below.
 */
function resolveFileUID(attributes: IInstalledModAttributes, gameId: string): string | undefined {
  if (attributes.fileId === undefined) return undefined;
  return (
    makeFileUID({
      gameId: attributes.downloadGame ?? gameId,
      fileId: attributes.fileId.toString(),
    }) ?? undefined
  );
}

/**
 * The active game's installed Nexus files (enabled and disabled) as resolver
 * input. Disabled files separate "disabled" / "wrong version" from "missing".
 * Collection-managed files are flagged `emitRequirements: false`.
 * Only includes mods with state "installed" - downloaded-not-installed mods
 * are gathered separately by gatherDownloadedFileRefs.
 */
export async function gatherInstalledFiles(api: IExtensionApi): Promise<IInstalledFileRef[]> {
  const state = api.getState();
  const profile = activeProfile(state);
  const gameId = profile?.gameId;
  if (!gameId) {
    return [];
  }

  // makeFileUID needs the Nexus games list, populated async on startup.
  await nexusGamesProm();

  const mods = state.persistent.mods[gameId] ?? {};
  const collectionTags = collectionManagedTags(mods, profile);
  const refs: IInstalledFileRef[] = [];

  for (const mod of Object.values(mods)) {
    if (mod.state !== "installed") continue;
    const attributes: IInstalledModAttributes = mod.attributes ?? {};
    if (attributes.source !== "nexus" || mod.type === "collection") {
      continue;
    }

    const fileUID = resolveFileUID(attributes, gameId);
    if (!fileUID) {
      continue;
    }

    refs.push({
      fileUID,
      modId: mod.id,
      enabled: getSafe(profile.modState, [mod.id, "enabled"], false),
      emitRequirements: !(
        attributes.referenceTag != null && collectionTags.has(attributes.referenceTag)
      ),
    });
  }

  return refs;
}

/**
 * A downloaded-but-not-installed Nexus archive. The download ID doubles as the
 * archive ID for start-install-download, so no mod-store lookup is needed.
 */
export interface IDownloadedFileRef {
  /** Composite file version id for the resolver's uninstalledFileVersionUids set. */
  fileUID: string;
  /** Download ID - passed directly to start-install-download as the archive ID. */
  downloadId: string;
}

/**
 * The active game's downloaded-but-not-installed Nexus archives, read from the
 * downloads store. A download is considered "not installed" when its corresponding
 * mod entry is absent from the mod store (covers both never-installed and
 * previously-installed-then-removed archives).
 */
export async function gatherDownloadedFileRefs(api: IExtensionApi): Promise<IDownloadedFileRef[]> {
  const state = api.getState();
  const profile = activeProfile(state);
  const gameId = profile?.gameId;
  if (!gameId) {
    return [];
  }

  await nexusGamesProm();

  const downloads: { [dlId: string]: IDownload } = state.persistent.downloads?.files ?? {};
  const refs: IDownloadedFileRef[] = [];

  for (const [downloadId, download] of Object.entries(downloads)) {
    if (download.state !== "finished") continue;
    if (!download.game.includes(gameId)) continue;

    const nexusIds = download.modInfo?.nexus?.ids;
    if (!nexusIds?.fileId) continue;

    // Skip if currently installed: the installed mod entry still exists in the store.
    if (download.installed != null) {
      const installedMod =
        state.persistent.mods[download.installed.gameId]?.[download.installed.modId];
      if (installedMod?.state === "installed") continue;
    }

    const nexusGameId = nexusIds.gameId ?? gameId;
    const fileUID = makeFileUID({ gameId: nexusGameId, fileId: String(nexusIds.fileId) });
    if (!fileUID) continue;

    refs.push({ fileUID, downloadId });
  }

  return refs;
}

/** Build the display shape for one downloaded-but-not-installed archive. */
function toDownloadedFile(
  downloadId: string,
  download: IDownload,
  fileUID: string,
): IDownloadedFile {
  const nexusIds = download.modInfo?.nexus?.ids;
  const nexusGameId = nexusIds?.gameId ?? download.game[0] ?? "";
  const modUID =
    makeModUID({
      gameId: nexusGameId,
      modId: String(nexusIds?.modId ?? ""),
      fileId: String(nexusIds?.fileId ?? ""),
    }) ?? "";
  const modName = download.modInfo?.name ?? download.localPath ?? downloadId;
  return {
    downloadId,
    fileUID,
    modUID,
    modName,
    fileName: download.modInfo?.meta?.fileName ?? download.localPath ?? modName,
    version: download.modInfo?.meta?.fileVersion ?? "",
    thumbnailUrl: download.modInfo?.nexus?.modInfo?.picture_url ?? undefined,
    adultContent: download.modInfo?.nexus?.modInfo?.contains_adult_content ?? false,
  };
}

/**
 * A fileUID -> IDownloadedFile hydrator over downloaded-but-not-installed refs.
 */
export function makeDownloadedFileHydrator(
  api: IExtensionApi,
  refs: IDownloadedFileRef[],
): (fileUID: string) => IDownloadedFile | undefined {
  const state = api.getState();
  const downloads: { [dlId: string]: IDownload } = state.persistent.downloads?.files ?? {};
  const refByUID = new Map(refs.map((ref): [string, IDownloadedFileRef] => [ref.fileUID, ref]));

  return (fileUID) => {
    const ref = refByUID.get(fileUID);
    if (!ref) return undefined;
    const download = downloads[ref.downloadId];
    if (!download) return undefined;
    return toDownloadedFile(ref.downloadId, download, fileUID);
  };
}

/**
 * Build the display shape for one installed file from its Vortex mod.
 */
function toInstalledFile(
  mod: IMod,
  fileUID: string,
  enabled: boolean,
  gameId: string,
  adultContent: boolean,
): IInstalledFile {
  const attributes: IInstalledModAttributes = mod.attributes ?? {};
  const modName = renderModName(mod);
  const modUID =
    makeModUID({
      gameId: attributes.downloadGame ?? gameId,
      modId: String(attributes.modId ?? ""),
      fileId: String(attributes.fileId ?? ""),
    }) ?? "";
  return {
    modId: mod.id,
    fileUID,
    modUID,
    modName,
    fileName: attributes.fileName ?? attributes.logicalFileName ?? modName,
    version: attributes.version ?? "",
    thumbnailUrl: attributes.pictureUrl,
    adultContent,
    enabled,
  };
}

/**
 * A `fileUID -> IInstalledFile` hydrator over the gathered refs, reading the mod
 * store on demand so only surfaced files are hydrated. The adult-content flag is
 * read from the originating download (linked via `archiveId`), or defaults to false.
 */
export function makeInstalledFileHydrator(
  api: IExtensionApi,
  refs: IInstalledFileRef[],
): (fileUID: string) => IInstalledFile | undefined {
  const state = api.getState();
  const gameId = activeProfile(state)?.gameId;
  const mods = gameId ? (state.persistent.mods[gameId] ?? {}) : {};
  const downloads = state.persistent.downloads?.files ?? {};
  const refByUID = new Map(refs.map((ref): [string, IInstalledFileRef] => [ref.fileUID, ref]));

  return (fileUID) => {
    const ref = refByUID.get(fileUID);
    if (!ref) {
      return undefined;
    }
    const mod = mods[ref.modId];
    if (!mod) {
      return undefined;
    }
    const download = mod.archiveId ? downloads[mod.archiveId] : undefined;
    const adultContent = download?.modInfo?.nexus?.modInfo?.contains_adult_content ?? false;
    return toInstalledFile(mod, fileUID, ref.enabled, gameId, adultContent);
  };
}
