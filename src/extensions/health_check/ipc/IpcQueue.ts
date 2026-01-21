/**
 * IPC Queue Manager (Renderer Process)
 * Provides queuing for IPC communication to prevent memory spikes
 * and ensure stable performance with many concurrent health checks.
 */

import { ipcRenderer } from "electron";
import { log } from "../../../util/log";
import { unknownToError } from "../../../shared/errors";
import {
  type ChunkedResponse,
  isChunkedMetadata,
  reassembleChunks,
} from "./chunking";
import { IPC_CHANNELS } from "./channels";

/** Maximum concurrent IPC calls */
const DEFAULT_MAX_CONCURRENT = 2;

interface QueuedRequest<T> {
  channel: string;
  args: unknown[];
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Queue manager for IPC requests with concurrency control
 */
class IpcQueueManager {
  private queue: QueuedRequest<unknown>[] = [];
  private activeCount = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = DEFAULT_MAX_CONCURRENT) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a request to the queue
   */
  public invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        channel,
        args,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * Process queued requests up to max concurrency
   */
  private processQueue(): void {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        this.executeRequest(request);
      }
    }
  }

  /**
   * Execute a single IPC request, handling chunked responses
   */
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    this.activeCount++;

    try {
      const result = await ipcRenderer.invoke(request.channel, ...request.args);

      // Check if response is chunked metadata (need to fetch chunks)
      if (isChunkedMetadata(result)) {
        const reassembled = await this.fetchChunks<T>(
          request.channel,
          result.totalChunks,
          request.args,
        );
        request.resolve(reassembled as T);
      } else {
        request.resolve(result as T);
      }
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  /**
   * Fetch all chunks for a chunked response
   */
  private async fetchChunks<T>(
    baseChannel: string,
    totalChunks: number,
    originalArgs: unknown[],
  ): Promise<T | null> {
    const chunks: ChunkedResponse[] = [];

    log("debug", "Fetching chunked response", { baseChannel, totalChunks });

    // Fetch chunks sequentially to avoid memory spikes
    for (let i = 0; i < totalChunks; i++) {
      try {
        const chunk = await ipcRenderer.invoke(
          IPC_CHANNELS.FETCH_CHUNK,
          baseChannel,
          i,
          ...originalArgs,
        );
        if (chunk) {
          chunks.push(chunk as ChunkedResponse);
        }
      } catch (error) {
        log("error", "Failed to fetch chunk", { chunkIndex: i, error: unknownToError(error) });
        return null;
      }
    }

    return reassembleChunks<T>(chunks);
  }

  /**
   * Get current queue status
   */
  public getStatus(): { queued: number; active: number } {
    return {
      queued: this.queue.length,
      active: this.activeCount,
    };
  }

  /**
   * Clear all pending requests
   */
  public clear(): void {
    const pending = this.queue.splice(0);
    for (const request of pending) {
      request.reject(new Error("Queue cleared"));
    }
  }
}

// Singleton instance
let queueInstance: IpcQueueManager | null = null;

/**
 * Get the IPC queue instance
 */
export function getIpcQueue(): IpcQueueManager {
  if (!queueInstance) {
    queueInstance = new IpcQueueManager();
  }
  return queueInstance;
}

/**
 * Reset the queue (for testing or cleanup)
 */
export function resetIpcQueue(): void {
  if (queueInstance) {
    queueInstance.clear();
    queueInstance = null;
  }
}

export type { IpcQueueManager };
