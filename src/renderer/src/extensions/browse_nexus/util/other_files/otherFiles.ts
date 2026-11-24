import type { IFileInfo } from "@nexusmods/nexus-api";
import { VortexModId } from "@vortex/shared";

import type { XOr } from "@/ui/utils/types";

import { type INexusModRef, modKey } from "../mod_install_state/modInstallState";
import {
  type IUserModFileSources,
  storedNameOf,
  userModFilesOf,
} from "../user_mod_files/userModFiles";

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

/** One of the user's files, before grouping: the file, and what it's grouped and deduped by. */
interface IOwnFile {
  /** The file, as it's listed. */
  file: OtherFile;
  /** Its id on the site, by which repeats of it are listed once; none if it wasn't stored. */
  fileId: number | undefined;
  /** Its category, as the site has it now or as it was stored. */
  category: string | undefined;
}

/**
 * The files the user has of a mod that aren't Main files, from `userModFilesOf`, grouped by
 * category: an installed file once, as its mod, and a download only when nothing is. Each
 * file's category and name come from `files`, the site's list, falling back to what was stored
 * when the user got it. Files of no category here, or Main as stored but gone from the site, are
 * left out.
 */
export const otherFilesOf = (
  sources: IUserModFileSources,
  ref: Omit<INexusModRef, "fileId">,
  files: IFileInfo[],
): IOtherFileGroup[] => {
  const live = new Map(files.map((file) => [file.file_id, file]));

  const own = userModFilesOf(sources, modKey(ref.domain, ref.modId)).map((owned): IOwnFile => {
    if (owned.kind === "installed") {
      const { mod } = owned;
      const fileId = Number(mod.attributes?.fileId) || undefined;
      const file = fileId ? live.get(fileId) : undefined;

      return {
        file: {
          modId: VortexModId(mod.id),
          name: file?.name ?? storedNameOf(owned),
        },
        fileId,
        category: file?.category_name ?? mod.attributes?.fileType,
      };
    }

    const info = owned.download.modInfo?.nexus;
    const fileId = Number(info?.ids?.fileId) || undefined;
    const file = fileId ? live.get(fileId) : undefined;

    return {
      file: {
        downloadId: owned.downloadId,
        name: file?.name ?? storedNameOf(owned),
      },
      fileId,
      category: file?.category_name ?? info?.fileInfo?.category_name,
    };
  });

  const seen = new Set<number>();
  const kept = own.filter(({ fileId }) => {
    if (!fileId) {
      return true;
    }

    if (seen.has(fileId)) {
      return false;
    }

    seen.add(fileId);
    return true;
  });

  return OTHER_FILE_CATEGORIES.map((category) => ({
    category,
    files: kept
      .filter((own) => own.category === category)
      .map(({ file }) => file)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.files.length > 0);
};
