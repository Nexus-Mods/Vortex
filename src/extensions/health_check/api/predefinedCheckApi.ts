/**
 * Predefined Check API - Renderer Process
 * Handles predefined health checks that run in the main process
 * Uses IPC queue with chunking for large payloads
 */

import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import { log } from "../../../util/log";
import type { PredefinedCheckId } from "../types";
import { getIpcQueue } from "../ipc/IpcQueue";
import { IPC_CHANNELS } from "../ipc/channels";
import { unknownToError } from "../../../shared/errors";

export interface IPredefinedCheckApi {
  run: (
    checkId: PredefinedCheckId,
    params?: unknown,
  ) => Promise<IHealthCheckResult | null>;
  list: () => Promise<PredefinedCheckId[]>;
}

export function createPredefinedCheckApi(): IPredefinedCheckApi {
  const queue = getIpcQueue();

  return {
    /**
     * Run a predefined health check in the main process
     * Uses queued IPC with automatic chunking for large results
     * @param checkId - ID of the predefined check (e.g., 'check-mod-dependencies')
     * @param params - Optional parameters for the check
     * @returns Result or null if check failed
     */
    run: async (checkId: PredefinedCheckId, params?: unknown) => {
      try {
        log("debug", "Queuing predefined check", { checkId });
        const result = await queue.invoke<IHealthCheckResult | null>(
          IPC_CHANNELS.RUN_PREDEFINED,
          checkId,
          params,
        );
        log("debug", "Predefined check completed", { checkId });
        return result;
      } catch (error) {
        log(
          "error",
          `Failed to run predefined check ${checkId}`,
          unknownToError(error),
        );
        return null;
      }
    },

    /**
     * List all available predefined checks
     * @returns Array of check IDs
     */
    list: async () => {
      try {
        return await queue.invoke<PredefinedCheckId[]>(
          IPC_CHANNELS.LIST_PREDEFINED,
        );
      } catch (error) {
        log("error", "Failed to list predefined checks", unknownToError(error));
        return [];
      }
    },
  };
}
