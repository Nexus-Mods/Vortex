/**
 * Updater Main Process
 * Handles auto-update functionality in the main process
 */

import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../logging";
import { setupAutoUpdater } from "./autoupdater";

/**
 * Initialize the updater in the main process.
 * Should be called once during application startup.
 *
 * @param installType Application install type ("regular", "managed", etc.)
 */
export function initUpdater(installType: string): void {
  try {
    if (installType === "regular" || process.env.NODE_ENV === "development") {
      setupAutoUpdater(installType);
    }
  } catch (err) {
    log("error", "failed to initialize updater", getErrorMessageOrDefault(err));
  }

  log("info", "updater initialized", {
    isPreviewBuild: process.env.IS_PREVIEW_BUILD,
    installType,
  });
}
