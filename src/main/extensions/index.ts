/**
 * Main Process Extensions Initialization
 *
 * This module coordinates the initialization of extension main process components.
 * Each extension that needs main process functionality has a dedicated file here.
 */

import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import { initNexusIntegration } from "./nexusIntegration";
import { initUpdater } from "./updater";

let initialized = false;

/**
 * Set up IPC handler for main process extensions initialization.
 * Should be called once during application startup.
 */
export function setupMainExtensions(): void {
  betterIpcMain.on(
    "extensions:init-all-main",
    (_event, installType: string) => {
      if (initialized) {
        log("debug", "Main extensions already initialized");
        return;
      }

      log("info", "Initializing main process extensions", { installType });

      // Initialize extensions
      initUpdater(installType);
      initNexusIntegration();

      initialized = true;
      log("info", "Main process extensions initialized");
    },
  );

  log("info", "Main process extensions IPC handler registered");
}
