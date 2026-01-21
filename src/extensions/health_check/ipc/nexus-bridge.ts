/**
 * IPC bridge for main process to call Nexus API functions in renderer.
 * Uses SharedBuffer for efficient data transfer of large payloads.
 *
 * Since api.ext is only populated in the renderer process (where extensions
 * register their APIs), the main process needs to request the renderer to
 * execute Nexus API calls on its behalf.
 */

import { ipcMain, ipcRenderer } from "electron";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IModRequirements } from "@nexusmods/nexus-api";
import { log } from "../../../util/log";
import { IPC_CHANNELS } from "./channels";
import { SharedBuffer } from "./SharedBuffer";

/**
 * Shared buffer instance for the nexus bridge
 */
const nexusBridgeBuffer = new SharedBuffer("NexusBridgeBuffer");

/**
 * Initialize the shared buffer (called from main process)
 */
export function initNexusBridgeBuffer(
  size: number = 10 * 1024 * 1024,
): SharedArrayBuffer {
  return nexusBridgeBuffer.initialize(size);
}

/**
 * Attach to shared buffer (called from renderer process)
 */
export function attachNexusBridgeBuffer(buffer: SharedArrayBuffer): void {
  nexusBridgeBuffer.attach(buffer);
}

/**
 * Setup the renderer-side IPC handler for Nexus API calls
 * Call this in the renderer process during extension initialization
 */
export function setupNexusBridgeRenderer(api: IExtensionApi): void {
  // Handle requests from main process to fetch mod requirements
  ipcRenderer.on(
    IPC_CHANNELS.GET_MOD_REQUIREMENTS,
    async (_event, requestId: string, gameId: string, modIds: number[]) => {
      try {
        const nexusApi = api.ext.nexusGetModRequirements as
          | ((
              gameId: string,
              modIds: number[],
            ) => Promise<{ [modId: number]: Partial<IModRequirements> }>)
          | undefined;

        if (!nexusApi) {
          ipcRenderer.send(
            `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
            requestId,
            { error: "Nexus API not available", useSharedBuffer: false },
          );
          return;
        }

        const requirements = await nexusApi(gameId, modIds);

        // Try to use shared buffer for large data
        const useSharedBuffer =
          nexusBridgeBuffer.isReady() && nexusBridgeBuffer.write(requirements);

        log("debug", "IPC bridge: sending requirements to main", {
          requestId,
          gameId,
          modIdsRequested: modIds.length,
          requirementsReturned: Object.keys(requirements || {}).length,
          useSharedBuffer,
        });

        if (useSharedBuffer) {
          ipcRenderer.send(
            `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
            requestId,
            { useSharedBuffer: true },
          );
        } else {
          // Fallback to direct IPC
          ipcRenderer.send(
            `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
            requestId,
            { data: requirements, useSharedBuffer: false },
          );
        }
      } catch (error) {
        const err = error as Error;
        log("warn", "Failed to fetch mod requirements via IPC bridge", {
          gameId,
          modIds,
          error: err.message,
        });
        ipcRenderer.send(
          `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
          requestId,
          { error: err.message, useSharedBuffer: false },
        );
      }
    },
  );

  log("debug", "Nexus bridge renderer handler registered");
}

/**
 * Request mod requirements from renderer process
 * Call this from the main process
 */
export function requestModRequirementsFromRenderer(
  webContents: Electron.WebContents,
  gameId: string,
  modIds: number[],
): Promise<{ [modId: number]: Partial<IModRequirements> } | null> {
  return new Promise((resolve, reject) => {
    const requestId = `${gameId}-${modIds.length}-${Date.now()}`;
    const timeout = setTimeout(() => {
      ipcMain.removeListener(
        `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
        handler,
      );
      reject(new Error("Timeout waiting for mod requirements"));
    }, 30000);

    const handler = (
      _event: Electron.IpcMainEvent,
      responseId: string,
      response: {
        data?: { [modId: number]: Partial<IModRequirements> };
        error?: string;
        useSharedBuffer?: boolean;
      },
    ) => {
      if (responseId !== requestId) return;

      clearTimeout(timeout);
      ipcMain.removeListener(
        `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
        handler,
      );

      if (response.error) {
        reject(new Error(response.error));
        return;
      }

      let data: { [modId: number]: Partial<IModRequirements> } | null;

      if (response.useSharedBuffer) {
        // Read from shared buffer
        data = nexusBridgeBuffer.read<{
          [modId: number]: Partial<IModRequirements>;
        }>();
        log(
          "debug",
          "IPC bridge (main): read requirements from shared buffer",
          {
            responseId,
            dataKeysCount: data ? Object.keys(data).length : 0,
          },
        );
      } else {
        data = response.data || null;
        log("debug", "IPC bridge (main): received requirements via IPC", {
          responseId,
          dataKeysCount: data ? Object.keys(data).length : 0,
        });
      }

      resolve(data);
    };

    ipcMain.on(`${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`, handler);
    webContents.send(
      IPC_CHANNELS.GET_MOD_REQUIREMENTS,
      requestId,
      gameId,
      modIds,
    );
  });
}

/**
 * Cleanup IPC handlers and reset buffer state
 */
export function cleanupNexusBridgeRenderer(): void {
  ipcRenderer.removeAllListeners(IPC_CHANNELS.GET_MOD_REQUIREMENTS);
  ipcRenderer.removeAllListeners(IPC_CHANNELS.NEXUS_BRIDGE_BUFFER_READY);
}
