import { getErrorCode } from "@vortex/shared";

import * as fs from "./fs";

/**
 * Whether `dirPath` is definitively absent.
 * Probes the silent variant: the retrying wrapper raises the unlock dialog and
 * can change ACLs, which a probe has no business doing.
 */
export async function folderIsMissing(dirPath: string): Promise<boolean> {
  try {
    await fs.statSilentAsync(dirPath);
    return false;
  } catch (err: unknown) {
    return getErrorCode(err) === "ENOENT";
  }
}
