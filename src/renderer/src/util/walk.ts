import { getErrorCode } from "@vortex/shared";
import * as path from "path";

import { log } from "../logging";
import * as fs from "./fs";

export interface IWalkOptions {
  ignoreErrors?: string[] | true;
}

/**
 * recursively walk the target directory
 *
 * @param {string} target the directory to search
 * @param {any} callback called on each file and directory encountered. Receives the path and
 *                       corresponding fs stats as parameter. Should return a promise that will be
 *                       awaited before proceeding to the next directory. If this promise is
 *                       rejected, the walk is interrupted
 * @returns {Promise<void>} a promise that is resolved once the search is complete
 */
async function walk(
  target: string,
  callback: (iterPath: string, stats: fs.Stats) => PromiseLike<any>,
  options?: IWalkOptions,
): Promise<void> {
  const opt = options || {};

  try {
    let fileNames: string[];
    try {
      fileNames = await fs.readdirAsync(target);
    } catch (err) {
      if (getErrorCode(err) === "ENOENT") {
        log("debug", "walk: ENOENT on target", { target });
        return;
      }
      throw err;
    }

    const statResults = await Promise.all<fs.Stats | null>(
      fileNames.map((statPath) =>
        fs.lstatAsync(path.join(target, statPath))
          .catch(() => null),
      ),
    );

    const subDirs: string[] = [];
    const cbPromises: Array<PromiseLike<any>> = [];
    statResults.forEach((stat, idx) => {
      if (stat === null) {
        return;
      }
      const fullPath = path.join(target, fileNames[idx]);
      cbPromises.push(callback(fullPath, stat));
      if (stat.isDirectory() && path.extname(fullPath) !== ".asar") {
        subDirs.push(fullPath);
      }
    });

    const walkSubDirs = async () => {
      for (const subDir of subDirs) {
        await walk(subDir, callback, options);
      }
    };
    await Promise.all([...cbPromises, walkSubDirs()]);
  } catch (err) {
    const code = getErrorCode(err);
    if (
      opt.ignoreErrors !== undefined &&
      (opt.ignoreErrors === true ||
        (code && opt.ignoreErrors.indexOf(code) !== -1))
    ) {
      return;
    }
    throw err;
  }
}

export default walk;
