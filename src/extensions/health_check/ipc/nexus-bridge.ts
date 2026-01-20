/**
 * IPC bridge for main process to call Nexus API functions in renderer
 * Uses SharedArrayBuffer for efficient data transfer of large payloads.
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

/**
 * Shared buffer management for the bridge
 */
let sharedBuffer: SharedArrayBuffer | null = null;
let sharedDataView: Uint8Array | null = null;

// Header layout (16 bytes):
// [0-3]: Data length (uint32)
// [4-7]: Sequence number (uint32)
// [8-11]: Checksum (uint32)
// [12-15]: Reserved
const HEADER_SIZE = 16;

/**
 * Initialize the shared buffer (called from main process)
 */
export function initNexusBridgeBuffer(
  size: number = 10 * 1024 * 1024,
): SharedArrayBuffer {
  sharedBuffer = new SharedArrayBuffer(size);
  sharedDataView = new Uint8Array(sharedBuffer, HEADER_SIZE);

  // Initialize header
  const headerView = new DataView(sharedBuffer, 0, HEADER_SIZE);
  headerView.setUint32(0, 0); // length
  headerView.setUint32(4, 0); // sequence
  headerView.setUint32(8, 0); // checksum
  headerView.setUint32(12, 0); // reserved

  log("debug", "Nexus bridge SharedArrayBuffer initialized", { size });
  return sharedBuffer;
}

/**
 * Attach to shared buffer (called from renderer process)
 */
export function attachNexusBridgeBuffer(buffer: SharedArrayBuffer): void {
  sharedBuffer = buffer;
  sharedDataView = new Uint8Array(buffer, HEADER_SIZE);
  log("debug", "Nexus bridge attached to SharedArrayBuffer", {
    size: buffer.byteLength,
  });
}

/**
 * Write data to shared buffer
 */
function writeToSharedBuffer(data: unknown): boolean {
  if (!sharedBuffer || !sharedDataView) {
    return false;
  }

  try {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(json);

    const availableSpace = sharedDataView.length;
    if (encoded.length > availableSpace) {
      log("error", "Data too large for shared buffer", {
        dataSize: encoded.length,
        bufferSize: availableSpace,
      });
      return false;
    }

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < encoded.length; i++) {
      checksum = (checksum + encoded[i]) & 0xffffffff;
    }

    // Write data
    sharedDataView.set(encoded);

    // Update header atomically
    const currentSeq = Atomics.load(new Uint32Array(sharedBuffer, 4, 1), 0);
    Atomics.store(new Uint32Array(sharedBuffer, 8, 1), 0, checksum);
    Atomics.store(new Uint32Array(sharedBuffer, 0, 1), 0, encoded.length);
    Atomics.store(new Uint32Array(sharedBuffer, 4, 1), 0, currentSeq + 1);

    // Notify waiting threads
    Atomics.notify(new Int32Array(sharedBuffer, 4, 1), 0);

    return true;
  } catch (error) {
    log("error", "Failed to write to shared buffer", error);
    return false;
  }
}

/**
 * Read data from shared buffer
 */
function readFromSharedBuffer<T>(): T | null {
  if (!sharedBuffer || !sharedDataView) {
    return null;
  }

  try {
    const length = Atomics.load(new Uint32Array(sharedBuffer, 0, 1), 0);
    const storedChecksum = Atomics.load(new Uint32Array(sharedBuffer, 8, 1), 0);

    if (length === 0 || length > sharedDataView.length) {
      return null;
    }

    // Read data
    const data = sharedDataView.slice(0, length);

    // Verify checksum
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
      checksum = (checksum + data[i]) & 0xffffffff;
    }

    if (checksum !== storedChecksum) {
      log("warn", "Checksum mismatch in shared buffer read");
    }

    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json) as T;
  } catch (error) {
    log("error", "Failed to read from shared buffer", error);
    return null;
  }
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
          sharedBuffer !== null && writeToSharedBuffer(requirements);

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
        data = readFromSharedBuffer<{
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
  sharedBuffer = null;
  sharedDataView = null;
}
