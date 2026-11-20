export const HTTP_HEADER_SIZE: number = 16384;
export const DEBUG_PORT: string = "9222";

export const VCREDIST_URL: string =
  "https://learn.microsoft.com/en-US/cpp/windows/latest-supported-vc-redist";

/**
 * Marker file a linking deployment leaves in each folder it creates in a game folder, so a purge
 * knows the folder is Vortex's to remove.
 */
export const FOLDER_TAG_NAME: string = "__folder_managed_by_vortex";
/** The folder marker's name off Windows, hidden by the leading dot. */
export const FOLDER_TAG_NAME_HIDDEN: string = `.${FOLDER_TAG_NAME}`;
/** The folder marker's name in early Vortex versions. */
export const OLD_FOLDER_TAG_NAME: string = "__delete_if_empty";
