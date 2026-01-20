import { ipcMain } from "electron";
import type {
  IExtensionContext,
  IExtensionApi,
} from "../../types/IExtensionContext";
import {
  executePredefinedCheck,
  getAvailablePredefinedChecks,
} from "./core/PredefinedChecks";
import type { PredefinedCheckId } from "./types";
import { HealthCheckSharedBuffer } from "./ipc/shared-buffer";
import { initNexusBridgeBuffer } from "./ipc/nexus-bridge";
import { IPC_CHANNELS } from "./ipc/channels";
import { log } from "../../util/log";

/** Threshold for using SharedArrayBuffer (1MB) */
const SHARED_BUFFER_THRESHOLD = 1024 * 1024;

let api: IExtensionApi | null = null;
let sharedBuffer: HealthCheckSharedBuffer | null = null;
let nexusBridgeBuffer: SharedArrayBuffer | null = null;
let mainWebContents: Electron.WebContents | null = null;

/**
 * Get the webContents for IPC calls to renderer
 */
export function getHealthCheckWebContents(): Electron.WebContents | null {
  return mainWebContents;
}

/**
 * Main process entry point for health check extension
 * Handles predefined checks that can run in main process without function serialization
 *
 * Phase 1: Hybrid architecture with SharedArrayBuffer
 * - Extensions register custom checks in renderer (with functions)
 * - Predefined checks run in main process (pure functions, no serialization)
 * - Results use SharedArrayBuffer for large datasets (>1MB)
 */
export function initHealthCheckMain(context: IExtensionContext): boolean {
  try {
    api = context.api;

    // Note: Reducer is registered in index.ts (renderer) which runs during normal extension loading
    // The main process shares the same Redux store via IPC sync

    // Initialize SharedArrayBuffer (50MB for large mod collections)
    sharedBuffer = new HealthCheckSharedBuffer();
    sharedBuffer.initialize(50 * 1024 * 1024);

    // Register IPC handler for running predefined checks
    ipcMain.handle(
      IPC_CHANNELS.RUN_PREDEFINED,
      async (_event, checkId: PredefinedCheckId, params?: unknown) => {
        if (!api) {
          throw new Error("API not initialized");
        }
        log("debug", "Running predefined check via IPC", { checkId });
        try {
          const result = await executePredefinedCheck(checkId, api, params);

          // Check if result is large enough to use SharedArrayBuffer
          const resultJson = JSON.stringify([result]); // Wrap in array for consistency
          const resultSize = new TextEncoder().encode(resultJson).length;

          if (resultSize > SHARED_BUFFER_THRESHOLD && sharedBuffer) {
            log("debug", "Using SharedArrayBuffer for large result", {
              checkId,
              size: resultSize,
            });

            // Write to SharedArrayBuffer
            const success = sharedBuffer.writeResults([result]);

            if (success) {
              // Return indicator that data is in shared buffer
              return { useSharedBuffer: true, size: resultSize };
            }
          }

          // Return result directly via IPC (small data or SharedArrayBuffer failed)
          return result;
        } catch (error) {
          const err = error as Error;
          log("error", "Predefined check failed", {
            checkId,
            error: err.message,
          });
          throw error;
        }
      },
    );

    // Register IPC handler for listing available predefined checks
    ipcMain.handle(IPC_CHANNELS.LIST_PREDEFINED, async () => {
      return getAvailablePredefinedChecks();
    });

    log(
      "info",
      "Health check main process initialized with predefined checks",
      {
        availableChecks: getAvailablePredefinedChecks(),
      },
    );

    return true;
  } catch (error) {
    log("error", "Failed to initialize health check main process", error);
    return false;
  }
}

/**
 * Set the web contents for sending SharedArrayBuffer to renderer
 * Must be called after window creation
 */
export function setHealthCheckWebContents(
  webContents: Electron.WebContents,
): void {
  // Store reference for IPC calls to renderer
  mainWebContents = webContents;

  if (sharedBuffer && webContents) {
    const buffer = sharedBuffer.initialize();
    webContents.send(IPC_CHANNELS.SHARED_BUFFER_READY, { buffer });
    log("debug", "Shared buffer sent to renderer process");
  }

  if (webContents) {
    nexusBridgeBuffer = initNexusBridgeBuffer(10 * 1024 * 1024);
    webContents.send(IPC_CHANNELS.NEXUS_BRIDGE_BUFFER_READY, {
      buffer: nexusBridgeBuffer,
    });
    log("debug", "Nexus bridge buffer sent to renderer process");
  }
}

/**
 * Cleanup when extension is unloaded
 */
export function cleanupHealthCheckMain(): void {
  ipcMain.removeHandler(IPC_CHANNELS.RUN_PREDEFINED);
  ipcMain.removeHandler(IPC_CHANNELS.LIST_PREDEFINED);
  api = null;
  sharedBuffer = null;
  log("info", "Health check main process cleaned up");
}
