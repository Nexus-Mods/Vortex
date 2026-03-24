import type { ISMAPIPlatformVariant } from "./types";

/** Windows SMAPI archive/executable metadata. */
export const windowsSMAPIPlatform: ISMAPIPlatformVariant = {
  id: "windows",
  executableName: "StardewModdingAPI.exe",
  archiveFolder: "windows",
  dataFiles: ["windows-install.dat", "install.dat"],
  implemented: true,
};
