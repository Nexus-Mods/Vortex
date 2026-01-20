/**
 * Predefined Check API - Main Process
 * Handles predefined health checks that run in the main process
 */

import { ipcRenderer } from "electron";
import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import type { HealthCheckSharedBuffer } from "../ipc/shared-buffer";
import { log } from "../../../util/log";
import type { PredefinedCheckId } from "../types";

export interface IPredefinedCheckApi {
  run: (
    checkId: PredefinedCheckId,
    params?: unknown,
  ) => Promise<IHealthCheckResult | null>;
  list: () => Promise<PredefinedCheckId[]>;
}

export function createPredefinedCheckApi(
  sharedBuffer: HealthCheckSharedBuffer | null,
): IPredefinedCheckApi {
  return {
    /**
     * Run a predefined health check in the main process
     * @param checkId - ID of the predefined check (e.g., 'check-mod-dependencies')
     * @param params - Optional parameters for the check
     * @returns Result or null if check failed
     */
    run: async (checkId: PredefinedCheckId, params?: unknown) => {
      try {
        const response = await ipcRenderer.invoke(
          "health-check:run-predefined",
          checkId,
          params,
        );

        // Check if result is in SharedArrayBuffer
        if (
          response &&
          typeof response === "object" &&
          "useSharedBuffer" in response
        ) {
          log("debug", "Reading result from SharedArrayBuffer", {
            checkId,
            size: response.size,
          });

          if (sharedBuffer) {
            const results = sharedBuffer.readResults();
            if (results && results.length > 0) {
              return results[0]; // Single check result
            }
          }

          log("warn", "Failed to read from SharedArrayBuffer, result lost", {
            checkId,
          });
          return null;
        }

        // Result was returned directly via IPC (small data)
        return response;
      } catch (error) {
        log("error", `Failed to run predefined check ${checkId}`, error);
        return null;
      }
    },

    /**
     * List all available predefined checks
     * @returns Array of check IDs
     */
    list: async () => {
      try {
        return await ipcRenderer.invoke("health-check:list-predefined");
      } catch (error) {
        log("error", "Failed to list predefined checks", error);
        return [];
      }
    },
  };
}
