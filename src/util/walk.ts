import * as fs from './fs';

import Bluebird from 'bluebird';
import * as fsOrig from 'fs-extra';
import * as path from 'path';

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
 * @returns {Bluebird<void>} a promise that is resolved once the search is complete
 */
function walk(target: string,
              callback: (iterPath: string, stats: fs.Stats) => Bluebird<any>,
              options?: IWalkOptions): Bluebird<void> {
  const opt = options || {};
  let allFileNames: string[];

  return fs.readdirAsync(target)
    .catch(err => (err.code === 'ENOENT')
      ? Bluebird.resolve([])
      : Bluebird.reject(err))
    .then((fileNames: string[]) => {
      allFileNames = fileNames;
      return Bluebird.map(fileNames, (statPath: string) =>
        Bluebird.resolve(fsOrig.lstat([target, statPath].join(path.sep))).reflect());
    }).then((res: Array<Bluebird.Inspection<fs.Stats>>) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      const subDirs: string[] = [];
      const cbPromises: Array<Bluebird<any>> = [];
      res.forEach((stat, idx) => {
        if (!stat.isFulfilled()) {
          return;
        }
        const fullPath: string = path.join(target, allFileNames[idx]);
        cbPromises.push(callback(fullPath, stat.value()));
        if (stat.value().isDirectory() && (path.extname(fullPath) !== '.asar')) {
          subDirs.push(fullPath);
        }
      });
      return Bluebird.all(cbPromises.concat(Bluebird.mapSeries(subDirs, (subDir) =>
                         walk(subDir, callback))));
    })
    .catch(err => {
      if ((opt.ignoreErrors !== undefined)
          && ((opt.ignoreErrors === true)
              || (opt.ignoreErrors.indexOf(err.code) !== -1))) {
        return Bluebird.resolve();
      } else {
        return Bluebird.reject(err);
      }
    })
    .then(() => Bluebird.resolve());
}

export default walk;
