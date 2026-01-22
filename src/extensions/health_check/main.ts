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
import { IPC_CHANNELS } from "./ipc/channels";
import {
  chunkData,
  shouldChunk,
  estimateSize,
  CHUNK_THRESHOLD,
  type ChunkedResponse,
  type ChunkedMetadata,
} from "./ipc/chunking";
import { log } from "../../util/log";
import { unknownToError } from "../../shared/errors";

let api: IExtensionApi | null = null;
let mainWebContents: Electron.WebContents | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Cache for chunked results, keyed by request identifier
 * Chunks are stored temporarily until renderer fetches them all
 */
const chunkCache = new Map<
  string,
  { chunks: ChunkedResponse[]; timestamp: number }
>();

/** Cache TTL: 60 seconds */
const CHUNK_CACHE_TTL = 60 * 1000;

/**
 * Generate a cache key for chunked results
 */
function getChunkCacheKey(channel: string, ...args: unknown[]): string {
  return `${channel}:${JSON.stringify(args)}`;
}

/**
 * Clean up expired chunk cache entries
 */
function cleanupChunkCache(): void {
  const now = Date.now();
  for (const [key, entry] of chunkCache.entries()) {
    if (now - entry.timestamp > CHUNK_CACHE_TTL) {
      chunkCache.delete(key);
      log("debug", "Expired chunk cache entry removed", { key });
    }
  }
}

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
 * Features:
 * - Queued IPC with chunking for large payloads (>1MB)
 * - Prevents memory spikes from large health check results
 */
export function initHealthCheckMain(context: IExtensionContext): boolean {
  try {
    api = context.api;

    // Periodic cleanup of chunk cache
    cleanupInterval = setInterval(cleanupChunkCache, 30000);

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

          // Check if result needs chunking
          if (shouldChunk(result, CHUNK_THRESHOLD)) {
            const size = estimateSize(result);
            const chunks = chunkData(result);
            const cacheKey = getChunkCacheKey(
              IPC_CHANNELS.RUN_PREDEFINED,
              checkId,
              params,
            );

            // Store chunks in cache
            chunkCache.set(cacheKey, {
              chunks,
              timestamp: Date.now(),
            });

            log("debug", "Result chunked and cached", {
              checkId,
              size,
              totalChunks: chunks.length,
              cacheKey,
            });

            // Return metadata so renderer knows to fetch chunks
            const metadata: ChunkedMetadata = {
              chunked: true,
              totalChunks: chunks.length,
              totalSize: size,
            };
            return metadata;
          }

          // Return result directly via IPC (small data)
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

    // Register IPC handler for fetching individual chunks
    ipcMain.handle(
      IPC_CHANNELS.FETCH_CHUNK,
      async (
        _event,
        originalChannel: string,
        chunkIndex: number,
        ...originalArgs: unknown[]
      ) => {
        const cacheKey = getChunkCacheKey(originalChannel, ...originalArgs);
        const cached = chunkCache.get(cacheKey);

        if (!cached) {
          log("warn", "Chunk cache miss", { cacheKey, chunkIndex });
          return null;
        }

        if (chunkIndex < 0 || chunkIndex >= cached.chunks.length) {
          log("error", "Invalid chunk index", {
            chunkIndex,
            totalChunks: cached.chunks.length,
          });
          return null;
        }

        const chunk = cached.chunks[chunkIndex];

        log("debug", "Serving chunk from cache", {
          cacheKey,
          chunkIndex,
          totalChunks: cached.chunks.length,
        });

        // If this is the last chunk, clean up the cache entry
        if (chunkIndex === cached.chunks.length - 1) {
          chunkCache.delete(cacheKey);
          log("debug", "All chunks served, cache entry removed", { cacheKey });
        }

        return chunk;
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
        chunkThreshold: CHUNK_THRESHOLD,
      },
    );

    return true;
  } catch (error) {
    log(
      "error",
      "Failed to initialize health check main process",
      unknownToError(error),
    );
    return false;
  }
}

/**
 * Set the web contents for IPC calls to renderer
 * Must be called after window creation
 */
export function setHealthCheckWebContents(
  webContents: Electron.WebContents,
): void {
  mainWebContents = webContents;
  log("debug", "Health check webContents set");
}

/**
 * Cleanup when extension is unloaded
 */
export function cleanupHealthCheckMain(): void {
  ipcMain.removeHandler(IPC_CHANNELS.RUN_PREDEFINED);
  ipcMain.removeHandler(IPC_CHANNELS.LIST_PREDEFINED);
  ipcMain.removeHandler(IPC_CHANNELS.FETCH_CHUNK);

  // Clear cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  // Clear chunk cache
  chunkCache.clear();

  api = null;
  mainWebContents = null;
  log("info", "Health check main process cleaned up");
}
