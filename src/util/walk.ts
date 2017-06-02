import * as Promise from 'bluebird';
// use the standard fs-module for api-visible types so we don't force fs-extra-promise
// on everyone using the api.
import * as fsT from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

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
function walk(target: string,
              callback: (iterPath: string, stats: fsT.Stats) => Promise<any>): Promise<void> {
  let allFileNames: string[];

  return fs.readdirAsync(target)
    .then((fileNames: string[]) => {
      allFileNames = fileNames;
      return Promise.mapSeries(
          fileNames, (statPath: string) =>
                         fs.lstatAsync(path.join(target, statPath)).reflect());
    }).then((res: Array<Promise.Inspection<fsT.Stats>>) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      const subDirs: string[] = [];
      const cbPromises: Array<Promise<any>> = [];
      res.forEach((stat, idx) => {
        if (!stat.isFulfilled()) {
          return;
        }
        const fullPath: string = path.join(target, allFileNames[idx]);
        cbPromises.push(callback(fullPath, stat.value()));
        if (stat.value().isDirectory()) {
          subDirs.push(fullPath);
        }
      });
      return Promise.all(cbPromises.concat(Promise.mapSeries(subDirs, (subDir) =>
        walk(subDir, callback))));
    })
    .then(() => undefined);
}

export default walk;
