import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { getErrorCode } from "@vortex/shared";

import type {
  IGeneratedFile,
  LockfileContribution,
} from "../../mod_management/util/lockfileContributions";
import { pluginPath } from "./gameSupport";
import { withFileRetry } from "./PluginPersistor";

/** Declares a Gamebryo game's loadorder.txt and plugins.txt as they are on disk. */
export const pluginListContribution: LockfileContribution = async (_state, gameMode) => {
  const files: IGeneratedFile[] = [];
  for (const fileName of ["loadorder.txt", "plugins.txt"]) {
    const destinationPath = path.join(pluginPath(gameMode), fileName);
    try {
      files.push({
        destinationPath,
        content: await withFileRetry(() => readFile(destinationPath)),
      });
    } catch (err) {
      if (getErrorCode(err) !== "ENOENT") {
        throw err;
      }
    }
  }
  return files;
};
