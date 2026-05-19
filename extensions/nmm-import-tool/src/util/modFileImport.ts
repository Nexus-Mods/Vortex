import * as path from "path";

import { fs, util } from "@nexusmods/vortex-api";
import Promise from "bluebird";

/**
 * copy or move a list of mod archives
 * @param {string} modArchive
 * @param {string} destSavePath
 */
export function transferArchive(modArchivePath: string, destSavePath: string): Promise<void> {
  return fs.copyAsync(modArchivePath, path.join(destSavePath, path.basename(modArchivePath)));
}

function byLength(lhs: string, rhs: string): number {
  return lhs.length - rhs.length;
}
