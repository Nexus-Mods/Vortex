import * as path from "path";

import { getErrorCode } from "@vortex/shared";

import * as fs from "../../../util/fs";
import { GHOST_EXT } from "../statics";
import { pluginExtensions } from "./gameSupport";

async function isFile(fileName: string): Promise<boolean> {
  try {
    return !(await fs.isDirectoryAsync(fileName));
  } catch (err) {
    const code = getErrorCode(err);
    if (code === "ENOENT" || code === "UNKNOWN") {
      // Vortex's own 'vortex.deployment.json.XXXXXX.tmp' files can vanish between readdir and
      // stat; a missing path counts as a file since a .tmp name fails the plugin check anyway
      return true;
    }
    throw err;
  }
}

/** Whether fileName under filePath is a plugin file of the game; a ghosted name counts too. */
export async function isPlugin(
  filePath: string,
  fileName: string,
  gameMode: string,
): Promise<boolean> {
  const plainName =
    path.extname(fileName) === GHOST_EXT ? path.basename(fileName, GHOST_EXT) : fileName;
  if (
    plainName === "" ||
    !pluginExtensions(gameMode).includes(path.extname(path.basename(plainName)).toLowerCase())
  ) {
    return false;
  }
  return isFile(path.join(filePath, plainName));
}

/** The plugin files among fileNames (checked concurrently), in their original order. */
export async function selectPluginFiles(
  dir: string,
  fileNames: string[],
  gameMode: string,
): Promise<string[]> {
  const kept = await Promise.all(
    fileNames.map(async (fileName) =>
      (await isPlugin(dir, fileName, gameMode)) ? fileName : undefined,
    ),
  );
  return kept.filter((fileName): fileName is string => fileName !== undefined);
}
