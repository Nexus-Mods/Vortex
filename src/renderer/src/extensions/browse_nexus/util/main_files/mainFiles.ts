import type { IFileInfo } from "@nexusmods/nexus-api";

const MAIN_CATEGORY_ID = 1;

/** A mod's Main files, the primary one first and then the newest first. */
export const mainFilesOf = (files: IFileInfo[]): IFileInfo[] =>
  files
    .filter((file) => file.category_id === MAIN_CATEGORY_ID)
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        (b.uploaded_timestamp ?? 0) - (a.uploaded_timestamp ?? 0),
    );
