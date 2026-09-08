/**
 * Updater Main Process
 * Handles auto-update functionality in the main process
 */

import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../logging";
import { setupAutoUpdater } from "./autoupdater";

/**
 * Whether the updater should run at all. A managed install is updated by its launcher, and a
 * run-from-source build has to opt in: without VORTEX_DEV_UPDATER the library refuses to check
 * an unpackaged build anyway, so every check would fail after spending a real GitHub request.
 *
 * This is the single gate. Nothing downstream re-checks it, and the renderer is told the answer
 * rather than working it out, since only NODE_ENV is inlined into its bundle.
 */
export function isUpdaterActive(installType: string): boolean {
  // A build run from source has no uninstaller beside it, so identifyInstallType always calls it
  // "managed". The install type therefore says nothing in development and the opt-in decides on
  // its own; outside development it is the only thing that decides.
  if (process.env.NODE_ENV === "development") {
    return process.env.VORTEX_DEV_UPDATER === "1";
  }
  return installType === "regular";
}

/**
 * Initialize the updater in the main process.
 * Should be called once during application startup.
 *
 * @param installType Application install type ("regular" or "managed")
 */
export function initUpdater(installType: string): void {
  const active = isUpdaterActive(installType);

  try {
    if (active) {
      setupAutoUpdater(installType);
    }
  } catch (err) {
    log("error", "failed to initialize updater", getErrorMessageOrDefault(err));
  }

  // installType is logged alongside because "active": false on its own does not say whether
  // this is a managed install or a dev build without the opt-in
  log("info", "updater initialized", { installType, active });

  if (!active && process.env.NODE_ENV === "development") {
    log("debug", "Updater inactive in development, set VORTEX_DEV_UPDATER=1 to enable it");
  }
}
