import * as path from "node:path";

import type { VortexModStagingFolder } from "@vortex/shared";

/** Where a deployed file is; target is the mod's subfolder when mods aren't merged. */
export function deployedFilePath(
  basePath: string,
  target: string | undefined,
  relPath: string,
): string {
  return path.join(basePath, target || "", relPath);
}

/** Identifies a deployed file by mod and path; unmerged mods can share a relPath. */
export function deployedFileKey(source: VortexModStagingFolder, relPath: string): string {
  return `${source}\u0000${relPath}`;
}
