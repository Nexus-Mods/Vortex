import type { ISMAPIPlatformVariant } from "./types";

/**
 * macOS (darwin) stub metadata.
 *
 * This is intentionally stubbed and not wired for automatic installation yet.
 */
export const macosSMAPIPlatform: ISMAPIPlatformVariant = {
  id: "macos",
  executableName: "StardewModdingAPI",
  archiveFolder: "macos",
  dataFiles: ["macos-install.dat", "install.dat"],
  implemented: false,
  unsupportedReason:
    "SMAPI automatic installation on macOS is not implemented yet. Please install SMAPI manually.",
};
