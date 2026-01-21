/**
 * IPC bridge for main process to call Nexus API functions in renderer.
 *
 * Since api.ext is only populated in the renderer process (where extensions
 * register their APIs), the main process needs to request the renderer to
 * execute Nexus API calls on its behalf.
 *
 * Uses chunking for large payloads to prevent memory spikes.
 */

import { ipcMain, ipcRenderer } from "electron";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IModRequirements } from "@nexusmods/nexus-api";
import { log } from "../../../util/log";
import { IPC_CHANNELS } from "./channels";
import {
  chunkData,
  shouldChunk,
  reassembleChunks,
  CHUNK_THRESHOLD,
  type ChunkedResponse,
} from "./chunking";

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
            { error: "Nexus API not available" },
          );
          return;
        }

        const requirements = await nexusApi(gameId, modIds);

        log("debug", "IPC bridge: sending requirements to main", {
          requestId,
          gameId,
          modIdsRequested: modIds.length,
          requirementsReturned: Object.keys(requirements || {}).length,
        });

        // Check if data needs chunking
        if (shouldChunk(requirements, CHUNK_THRESHOLD)) {
          const chunks = chunkData(requirements);
          log("debug", "IPC bridge: chunking large requirements data", {
            requestId,
            totalChunks: chunks.length,
          });

          // Send chunks sequentially to avoid memory spikes
          for (const chunk of chunks) {
            ipcRenderer.send(
              `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:chunk`,
              requestId,
              chunk,
            );
          }

          // Signal completion
          ipcRenderer.send(
            `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
            requestId,
            { chunked: true, totalChunks: chunks.length },
          );
        } else {
          ipcRenderer.send(
            `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
            requestId,
            { data: requirements },
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
          { error: err.message },
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
    const receivedChunks: ChunkedResponse[] = [];

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout waiting for mod requirements"));
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      ipcMain.removeListener(
        `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
        responseHandler,
      );
      ipcMain.removeListener(
        `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:chunk`,
        chunkHandler,
      );
    };

    // Handle incoming chunks
    const chunkHandler = (
      _event: Electron.IpcMainEvent,
      chunkRequestId: string,
      chunk: ChunkedResponse,
    ) => {
      if (chunkRequestId !== requestId) return;
      receivedChunks.push(chunk);
      log("debug", "IPC bridge (main): received chunk", {
        requestId,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
      });
    };

    const responseHandler = (
      _event: Electron.IpcMainEvent,
      responseId: string,
      response: {
        data?: { [modId: number]: Partial<IModRequirements> };
        error?: string;
        chunked?: boolean;
        totalChunks?: number;
      },
    ) => {
      if (responseId !== requestId) return;

      cleanup();

      if (response.error) {
        reject(new Error(response.error));
        return;
      }

      let data: { [modId: number]: Partial<IModRequirements> } | null;

      if (response.chunked) {
        // Reassemble chunks
        data = reassembleChunks<{
          [modId: number]: Partial<IModRequirements>;
        }>(receivedChunks);
        log("debug", "IPC bridge (main): reassembled chunked requirements", {
          responseId,
          chunksReceived: receivedChunks.length,
          dataKeysCount: data ? Object.keys(data).length : 0,
        });
      } else {
        data = response.data || null;
        log("debug", "IPC bridge (main): received requirements via IPC", {
          responseId,
          dataKeysCount: data ? Object.keys(data).length : 0,
        });
      }

      resolve(data);
    };

    ipcMain.on(`${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:chunk`, chunkHandler);
    ipcMain.on(
      `${IPC_CHANNELS.GET_MOD_REQUIREMENTS}:response`,
      responseHandler,
    );
    webContents.send(
      IPC_CHANNELS.GET_MOD_REQUIREMENTS,
      requestId,
      gameId,
      modIds,
    );
  });
}

/**
 * Cleanup IPC handlers
 */
export function cleanupNexusBridgeRenderer(): void {
  ipcRenderer.removeAllListeners(IPC_CHANNELS.GET_MOD_REQUIREMENTS);
}
