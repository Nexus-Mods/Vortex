import { getErrorCode } from "@vortex/shared";

import { delayed } from "./util";

const retryCount = 3;

/** How long to wait before another attempt. */
const RETRY_DELAY_MS = 100;

/**
 * Codes that mean another process holds the file, rather than that the operation is wrong. The
 * same set the elevated file operations retry on (symlink_activator_elevate/remoteCode.ts).
 */
const TRANSIENT_CODES = new Set(["EPERM", "EBUSY", "EIO", "EBADF", "UNKNOWN"]);

/**
 * Runs a file operation, retrying while another process is holding the file. The game, another
 * mod manager or an antivirus scanner all touch these files, so a first failure says little.
 */
export async function withFileRetry<T>(
  operation: () => Promise<T>,
  attempts: number = retryCount,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      if (attempt >= attempts || !TRANSIENT_CODES.has(getErrorCode(err) ?? "")) {
        throw err;
      }
      await delayed(RETRY_DELAY_MS);
    }
  }
}
