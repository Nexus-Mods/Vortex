import * as fs from "./fs";

import PromiseBB from "bluebird";
import * as fsOrig from "fs-extra";
import * as path from "path";
import { getErrorCode } from "@vortex/shared";

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
 * @returns {PromiseBB<void>} a promise that is resolved once the search is complete
 */
function walk(
  target: string,
  callback: (iterPath: string, stats: fs.Stats) => PromiseBB<any>,
  options?: IWalkOptions,
): PromiseBB<void> {
  const opt = options || {};
  let allFileNames: string[];

  return fs
    .readdirAsync(target)
    .catch((err) =>
      getErrorCode(err) === "ENOENT"
        ? PromiseBB.resolve([])
        : PromiseBB.reject(err),
    )
    .then((fileNames: string[]) => {
      allFileNames = fileNames;
      return PromiseBB.map(fileNames, (statPath: string) =>
        PromiseBB.resolve(
          fsOrig.lstat([target, statPath].join(path.sep)),
        ).reflect(),
      );
    })
    .then((res: Array<PromiseBB.Inspection<fs.Stats>>) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      const subDirs: string[] = [];
      const cbPromises: Array<PromiseBB<any>> = [];
      res.forEach((stat, idx) => {
        if (!stat.isFulfilled()) {
          return;
        }
        const fullPath: string = path.join(target, allFileNames[idx]);
        cbPromises.push(callback(fullPath, stat.value()));
        if (stat.value().isDirectory() && path.extname(fullPath) !== ".asar") {
          subDirs.push(fullPath);
        }
      });
      return PromiseBB.all(
        cbPromises.concat(
          PromiseBB.mapSeries(subDirs, (subDir) => walk(subDir, callback)),
        ),
      );
    })
    .catch((err) => {
      const code = getErrorCode(err);
      if (
        opt.ignoreErrors !== undefined &&
        (opt.ignoreErrors === true ||
          (code && opt.ignoreErrors.indexOf(code) !== -1))
      ) {
        return PromiseBB.resolve();
      } else {
        return PromiseBB.reject(err);
      }
    })
    .then(() => PromiseBB.resolve());
}

export default walk;
