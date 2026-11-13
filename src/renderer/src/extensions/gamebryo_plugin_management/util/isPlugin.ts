import * as path from "path";

import { getErrorCode } from "@vortex/shared";

import * as fs from "../../../util/fs";
import { pluginExtensions } from "./gameSupport";
import { unghost } from "./ghost";

async function isFile(filePath: string): Promise<boolean> {
  try {
    return !(await fs.isDirectoryAsync(filePath));
  } catch (err) {
    const code = getErrorCode(err);
    if (code === "ENOENT") {
      // gone between the directory listing and now, so there is nothing left to list
      return false;
    }
    if (code === "UNKNOWN") {
      // it is there, Windows just cannot tell what it is; the plugin name already says file
      return true;
    }
    throw err;
  }
}

/** Whether the name carries one of the game's plugin extensions, in any casing. */
export function isPluginName(fileName: string, gameMode: string): boolean {
  return pluginExtensions(gameMode).includes(path.extname(fileName).toLowerCase());
}

/** Whether fileName under filePath is a plugin file of the game; a ghosted name counts too. */
export async function isPlugin(
  filePath: string,
  fileName: string,
  gameMode: string,
): Promise<boolean> {
  if (!isPluginName(unghost(fileName), gameMode)) {
    return false;
  }
  return isFile(path.join(filePath, fileName));
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

/** The plugins of a mod's staging folder, by where their file is. */
export interface IStagedPlugins {
  /** plugin files that sit in the staging folder */
  staged: string[];
  /**
   * plugins the deployment method moved into the game, by their deployed name; the staging folder
   * only holds a differently named placeholder for each
   */
  movedOut: string[];
}

/**
 * Sorts a staging folder's entries into the plugins it holds and the plugins it only holds a
 * placeholder for. deployedName is the deployment method's getDeployedPath.
 */
export async function selectStagedPlugins(
  dir: string,
  fileNames: string[],
  gameMode: string,
  deployedName: (fileName: string) => string,
): Promise<IStagedPlugins> {
  const candidates: string[] = [];
  const movedOut: string[] = [];
  for (const fileName of fileNames) {
    const deployed = deployedName(fileName);
    if (deployed === fileName) {
      candidates.push(fileName);
    } else if (isPluginName(unghost(deployed), gameMode)) {
      movedOut.push(deployed);
    }
  }
  return { staged: await selectPluginFiles(dir, candidates, gameMode), movedOut };
}
