import type { IFileInfo } from "@nexusmods/nexus-api";

/** File categories a user would install; old, archived and removed files are left out. */
const INSTALLABLE_CATEGORIES = ["MAIN", "UPDATE", "OPTIONAL", "MISCELLANEOUS"];

function categoryOf(file: IFileInfo): string {
  return (file.category_name ?? "").toUpperCase();
}

/** Files to list on the mod page, main files first, newest first within a group. */
export function installableFiles(files: IFileInfo[] | undefined): IFileInfo[] {
  return (files ?? [])
    .filter((file) => INSTALLABLE_CATEGORIES.includes(categoryOf(file)))
    .sort((lhs, rhs) => {
      const byCategory =
        INSTALLABLE_CATEGORIES.indexOf(categoryOf(lhs)) -
        INSTALLABLE_CATEGORIES.indexOf(categoryOf(rhs));
      return byCategory !== 0 ? byCategory : rhs.uploaded_timestamp - lhs.uploaded_timestamp;
    });
}

/**
 * The file "Install" on a catalog card installs: the one the author marked primary, otherwise
 * the newest main file. Undefined when the mod has no main file, in which case the user has to
 * pick one on the mod page.
 */
export function pickPrimaryFile(files: IFileInfo[] | undefined): IFileInfo | undefined {
  const candidates = installableFiles(files);
  return (
    candidates.find((file) => file.is_primary && categoryOf(file) === "MAIN") ??
    candidates.find((file) => categoryOf(file) === "MAIN")
  );
}
