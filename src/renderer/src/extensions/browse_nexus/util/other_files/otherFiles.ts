import type { IFileInfo } from "@nexusmods/nexus-api";
import { VortexModId } from "@vortex/shared";

import { MOD_TYPE as COLLECTION_TYPE } from "@/extensions/collections/constants";
import type { XOr } from "@/ui/utils/types";

import {
  downloadKey,
  type IModInstallSources,
  type INexusModRef,
  modKey,
  nexusModKey,
} from "../mod_install_state/modInstallState";

/** The file categories, other than Main, that the user's files are grouped under, in order. */
export const OTHER_FILE_CATEGORIES = [
  "OPTIONAL",
  "MISCELLANEOUS",
  "UPDATE",
  "OLD_VERSION",
  "ARCHIVED",
] as const;

export type OtherFileCategory = (typeof OTHER_FILE_CATEGORIES)[number];

/** A file of the mod the user has, downloaded or installed, that isn't one of its Main files. */
export type OtherFile = {
  /** Its name on the site, or as it was when the user got it. */
  name: string;
} & XOr<
  {
    /** The mod it's installed as. */
    modId: VortexModId;
  },
  {
    /** Its download, for one that isn't installed. */
    downloadId: string;
  }
>;

/** The user's files of one category. */
export interface IOtherFileGroup {
  /** The category, as the site has it now. */
  category: OtherFileCategory;
  /** Its files, by name. */
  files: OtherFile[];
}

/** One of the user's files, before grouping. */
type OwnFile = OtherFile & { fileId: number | undefined; category: string | undefined };

/**
 * The files the user has of a mod that aren't Main files, grouped by category: an
 * installed file once, as its mod, and a download only when nothing is installed from it. Each
 * file's category and name come from `files`, the site's list, falling back to what was stored
 * when the user got it. Files of no category here, or Main as stored but gone from the site, are
 * left out.
 */
export const otherFilesOf = (
  { mods, downloads, gameId, domainOf }: Omit<IModInstallSources, "modState">,
  ref: Omit<INexusModRef, "fileId">,
  files: IFileInfo[],
): IOtherFileGroup[] => {
  const key = modKey(ref.domain, ref.modId);
  const live = new Map(files.map((file) => [file.file_id, file]));
  const own: OwnFile[] = [];
  const archiveIds = new Set<string>();

  for (const mod of Object.values(mods)) {
    if (mod.archiveId) {
      archiveIds.add(mod.archiveId);
    }

    const isInstalled = mod.state === "installed" && mod.type !== COLLECTION_TYPE;

    if (!isInstalled || nexusModKey(mod, gameId, domainOf) !== key) {
      continue;
    }

    const fileId = Number(mod.attributes?.fileId) || undefined;
    const file = fileId ? live.get(fileId) : undefined;

    own.push({
      modId: VortexModId(mod.id),
      fileId,
      category: file?.category_name ?? mod.attributes?.fileType,
      name: file?.name ?? mod.attributes?.logicalFileName ?? mod.attributes?.name ?? mod.id,
    });
  }

  for (const [id, download] of Object.entries(downloads)) {
    const isOf =
      download.state === "finished" &&
      !!download.game?.includes(gameId) &&
      downloadKey(download, domainOf) === key;

    if (!isOf || archiveIds.has(id)) {
      continue;
    }

    const info = download.modInfo?.nexus;
    const fileId = Number(info?.ids?.fileId) || undefined;
    const file = fileId ? live.get(fileId) : undefined;

    own.push({
      downloadId: id,
      fileId,
      category: file?.category_name ?? info?.fileInfo?.category_name,
      name: file?.name ?? info?.fileInfo?.name ?? download.localPath ?? id,
    });
  }

  const seen = new Set<number>();
  const kept = own.filter((file) => {
    if (!file.fileId) {
      return true;
    }

    if (seen.has(file.fileId)) {
      return false;
    }

    seen.add(file.fileId);
    return true;
  });

  return OTHER_FILE_CATEGORIES.map((category) => ({
    category,
    files: kept
      .filter((file) => file.category === category)
      .map(({ fileId, category, ...file }) => file)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.files.length > 0);
};
